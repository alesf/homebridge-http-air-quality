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

    this.pollingInterval = config['pollingInterval'] || 300;

    this.name = config['name'] || 'Air Quality';
    this.url = config['url'];
    this.httpMethod = config['httpMethod'] || 'GET';
    this.httpTimeout = config['httpTimeout'] || 3000;
    this.auth = config['auth'] || null;

    this.lastUpdate = 0;
    this.fetchInProgress = false;

    this.data = null;
    this.dataUpdated = null;

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

    this.characteristics = {
        air_quality: Characteristic.AirQuality,
        pm25: Characteristic.PM2_5Density,
        pm10: Characteristic.PM10Density,
        o3: Characteristic.OzoneDensity,
        no2: Characteristic.NitrogenDioxideDensity,
        so2: Characteristic.SulphurDioxideDensity,
        voc: Characteristic.VOCDensity,
    };
}

HttpAirQuality.prototype = {

    needsUpdate: function() {
        if (this.lastUpdate === 0) {
            return true;
        }

        if(this.lastUpdate + this.pollingInterval < (new Date().getTime() / 1000)) {
            return true;
        }

        if (this.data === null) {
            return true;
        }

        return false;
    },

    fetchData: function () {
        if (this.fetchInProgress) {
            this.log('Avoid fetchData as previous response has not arrived yet.');
            return false;
        }

        this.fetchInProgress = true;

        this.dataUpdated = new Promise((resolve, reject) => {
            var options = {
                uri: this.url,
                method: this.httpMethod,
                timeout: this.httpTimeout
            };
            this.log('Requesting air quality on "' + options.uri + '", method ' + options.method);

            if (this.auth) {
                options.auth = {
                    user: this.auth.user,
                    pass: this.auth.pass
                };
            }

            request(options, (error, res, body) => {
                var data = null;
                if (error) {
                    this.log('HTTP bad response (' + options.uri + '): ' + error.message);
                } else {
                    try {
                        data = this.parseData(body);
                        this.log('HTTP successful response: ' + body);
                        this.lastUpdate = new Date().getTime() / 1000;
                    } catch (parseErr) {
                        this.log('Error processing received information: ' + parseErr.message);
                        error = parseErr;
                    }
                }

                if (error) {
                    reject(error.message);
                } else {
                    resolve(data);
                }

                this.fetchInProgress = false;
            });
        }).then((data) => {
            for (const attr in data) {
                this.AQISensorService
                    .getCharacteristic(this.characteristics[attr])
                    .updateValue(data[attr], null);
            }

            return data;
        }, (error) => {
            // Avoid NodeJS warning about uncatched rejected promises
            return error;
        });
    },

    parseData: function(body) {
        var parsed = JSON.parse(body);
        var data = {};
        for (const attr in this.characteristics) {
            let value = parseFloat(parsed[attr]);
            if (!isNaN(value))  {
                data[attr] = value;
            }
        }

        if (Object.keys(data).length === 0) {
            this.data = null;
            throw new Error('Missing data');
        }

        if (!('air_quality' in data)) {
            let max_aqi = null;

            for (const attr in data) {
                this.limits[attr].forEach(function (limit, key) {
                    if (data[attr] > limit && max_aqi < key) {
                        max_aqi = key;
                    }
                });
            };

            data.air_quality = this.levels[max_aqi] || Characteristic.AirQuality.UNKNOWN;
        }

        this.data = data;

        return data;
    },

    getState: function (callback, characteristic) {
        if (!this.needsUpdate()) {
            callback(null, this.data[characteristic]);
            return this.data[characteristic];
        }

        this.fetchData();
        this.dataUpdated.then((data) => {
            callback(null, data[characteristic]);
            return data[characteristic];
        }, (error) => {
            callback(error, null);
            return error;
        });
    },

    getServices: function () {
        this.informationService = new Service.AccessoryInformation();
        this.informationService
            .setCharacteristic(Characteristic.Manufacturer, "AL.FA")
            .setCharacteristic(Characteristic.Model, "http/s")
            .setCharacteristic(Characteristic.SerialNumber, "0110-0110-0110");

        this.AQISensorService = new Service.AirQualitySensor(this.name);

        for (const attr in this.characteristics) {
            this.AQISensorService
                .getCharacteristic(this.characteristics[attr])
                .on('get', this.getState.bind(this, attr));
        }

        if (this.pollingInterval > 0) {
            this.timer = setInterval(this.fetchData.bind(this), this.pollingInterval * 1000);
        }

        return [this.informationService, this.AQISensorService];
    }
};
