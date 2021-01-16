"use strict";

const request = require('request');
let Service, Characteristic;

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-http-air-quality", "HttpAirQuality", HttpAirQuality);
};

function HttpAirQuality(log, config) {
    this.log = log;

    this.pollingInterval = config.pollingInterval || 300;

    this.name = config.name || 'Air Quality';
    this.url = config.url;
    this.httpMethod = config.httpMethod || 'GET';

    this.lastUpdate = 0;

    this.data = undefined;

    // excelent, good, fair, inferior, poor
    this.limits = {
        pm10: [0, 20, 40, 75, 100],
        pm25: [0, 15, 30, 50, 70],
        o3: [0, 40, 100, 140, 180],
        no2: [0, 10, 30, 100, 150],
        so2: [0, 2, 35, 75, 185]
    }

    this.levels = {
        0: Characteristic.AirQuality.EXCELLENT,
        1: Characteristic.AirQuality.GOOD,
        2: Characteristic.AirQuality.FAIR,
        3: Characteristic.AirQuality.INFERIOR,
        4: Characteristic.AirQuality.POOR
    };
}

HttpAirQuality.prototype = {
    // fetch new data
    fetchData: function (params) {
        let self = this;

        request()
            .method(this.httpMethod)
            .url(this.url)
            .set("Accept", "application/json")
            .end(function (err, response, data) {
                if (!err && response.statusCode === 200) {
                    self.data = data;
                    self.lastUpdate = new Date().getTime() / 1000;
                    self.updateData(params);
                } else {
                    self.log("fetchData error");
                    self.AQISensorService.getCharacteristic(Characteristic.StatusFault).updateValue(1);
                }
                self.fetchInProgress = false;
            });
    },

    // wrapper for updateData method (new data/cache)
    setData: function (params) {
        if (this.lastUpdate === 0
            || this.lastUpdate + this.pollingInterval < (new Date().getTime() / 1000)
            || this.data === undefined
        ) {
            this.fetchData(params);
            return;
        }

        this.updateData(params);
    },

    // update sensors data
    updateData: function (params) {

        this.AQISensorService.getCharacteristic(Characteristic.StatusFault).updateValue(0);

        let self = this;
        let aqi_key = null;
        params['characteristics'].forEach(function (c) {
            if (self.data[c.key]) {
                let value = c.formatter(self.data[c.key]);
                self.log(c.key + ' = ' + value);
                if (!isNaN(value)) {
                    self.AQISensorService.getCharacteristic(c.characteristic).updateValue(value);
                    self.limits[c.key].forEach(function (limit, key) {
                        if (value > limit && aqi_key < key) {
                            aqi_key = key;
                        }
                    });
                }
            }
        });

        if ('air_quality' in self.data) {
            aqi_key = self.data['air_quality'];
        }

        if (!aqi_key) {
            this.AQISensorService.getCharacteristic(Characteristic.StatusFault).updateValue(1);
        }

        let AQI = self.levels[aqi_key] || Characteristic.AirQuality.UNKNOWN;
        this.AQISensorService.getCharacteristic(Characteristic.AirQuality).updateValue(AQI);

        params.callback(null, AQI);

        this.log('AQI = ' + AQI);
    },

    updateAQI: function (callback) {
        this.setData({
            callback: callback,
            characteristics: [
                {
                    'key': 'pm25',
                    'characteristic': Characteristic.PM2_5Density,
                    'formatter': value => parseFloat(value)
                },
                {
                    'key': 'pm10',
                    'characteristic': Characteristic.PM10Density,
                    'formatter': value => parseFloat(value)
                },
                {
                    'key': 'o3',
                    'characteristic': Characteristic.OzoneDensity,
                    'formatter': value => parseFloat(value)
                },
                {
                    'key': 'no2',
                    'characteristic': Characteristic.NitrogenDioxideDensity,
                    'formatter': value => parseFloat(value)
                },
                {
                    'key': 'so2',
                    'characteristic': Characteristic.SulphurDioxideDensity,
                    'formatter': value => parseFloat(value)
                },
                {
                    'key': 'voc',
                    'characteristic': Characteristic.VOCDensity,
                    'formatter': value => parseFloat(value)
                }
            ]
        });
    },

    identify: callback => callback(),

    getServices: function () {
        this.informationService = new Service.AccessoryInformation();
        this.informationService
            .setCharacteristic(Characteristic.Manufacturer, "Generic")
            .setCharacteristic(Characteristic.Model, "HTTP(S)")
            .setCharacteristic(Characteristic.SerialNumber, "0000-0000-0000");

        this.AQISensorService = new Service.AirQualitySensor(this.name);
        this.AQISensorService
            .getCharacteristic(Characteristic.AirQuality)
            .on('get', this.updateAQI.bind(this));

        return [this.informationService, this.AQISensorService];
    }
};
