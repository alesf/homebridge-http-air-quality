"use strict";

const request = require('request');
let Service, Characteristic;

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory("homebridge-air-quality", "AirQuality", AirQuality);
};

/**
 * Air Accessory
 */
function AirQuality(log, config) {
    this.log = log;

    this.pollingInterval = config.pollingInterval || 300;

    this.url = config.url;
    this.httpMethod = config.httpMethod || 'GET';

    this.name = config.name || 'Air Quality';
    this.airQualityIndexName = config.airQualityIndexName || 'Air Quality';

    this.lastUpdate = 0;
    this.sensors = {};
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

AirQuality.prototype = {

    // wrapper for updateData method (new data/cache)
    setData: function (params) {
        if (this.lastUpdate === 0 || this.lastUpdate + this.pollingInterval < (new Date().getTime() / 1000) || this.data === undefined) {
            this.fetchData(params);
            return;
        }

        this.updateData(params);
    },

    // update sensors data
    updateData: function (params) {
        let self = this;

        if (params['key'] in self.data) {
            let widget = self.sensors[params['key']];

            widget.setCharacteristic(Characteristic.StatusFault, 0);
            let aqi_key = undefined;
            params['characteristics'].forEach(function (characteristic) {
                if (self.data[characteristic.key]) {
                    let value = characteristic.formatter(self.data[characteristic.key]);
                    self.log.debug(characteristic.key + ' = ' + value);
                    if (!isNaN(value)) {
                        widget.setCharacteristic(characteristic.characteristic, value);
                        self.limits[characteristic.key].forEach(function (limit, key) {
                            if (value > limit) {
                                aqi_key = key;
                            }
                        });
                    }
                }
            });
            let AQI = aqi_key !== undefined ? self.levels[aqi_key] : Characteristic.AirQuality.UNKNOWN;
            self.log.debug(params['key'] + ' = ' + AQI);
            params.callback(null, AQI);
        } else {
            this.sensors[params['key']].setCharacteristic(Characteristic.StatusFault, 1);
            self.log.debug(params['key'] + ' = no value');
            params.callback(null);
        }
    },

    // fetch new data from Airly
    fetchData: function (params) {
        let self = this;

        request(this.httpMethod, this.url)
            .set("Accept", "application/json")
            .end(function (err, response, data) {
                if (!err && response.statusCode === 200) {
                    self.data = data;
                    self.lastUpdate = new Date().getTime() / 1000;
                    self.updateData(params);
                } else {
                    self.log("fetchData error");
                }
                self.fetchInProgress = false;
            });
    },

    updateAirQualityIndex: function (callback) {
        this.setData({
            'callback': callback,
            'key': 'air_quality',
            'characteristics': [
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
        let informationService = new Service.AccessoryInformation();
        informationService
            .setCharacteristic(Characteristic.Manufacturer, "Generic")
            .setCharacteristic(Characteristic.Model, "HTTP(S)")
            .setCharacteristic(Characteristic.SerialNumber, "0000-0000-0000");
        this.sensors['information'] = informationService;


        let airQualityIndexSensorService = new Service.AirQualitySensor(this.airQualityIndexName);
        airQualityIndexSensorService.getCharacteristic(Characteristic.AirQuality).on('get', this.updateAirQualityIndex.bind(this));
        this.sensors['air_quality'] = airQualityIndexSensorService;

        return Object.values(this.sensors);
    }
};
