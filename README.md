# homebridge-http-air-quality
HTTP Air quality accessory for Homebridge

## Sample config

Minimal:

	{
		"accessory": "HttpAirQuality",
		"url": "http://localhost/airquality",
	}

Full:

	{
		"accessory": "HttpAirQuality",
		"name": "Air Quality",
		"url": "http://localhost/airquality",
		"httpMethod": "GET",
		"pollingInterval": 300
	}

## Sample data

	{
		air_quality: 1,
		pm10: 32,
		pm25: 26,
		so2: 3,
		o3: 25,
		no2: 21
	}

	If you do not provide air_quality it will be calculated from other values.
	All values are optional. Only provided values will be used.

## Air Quality value meaning

	0: Characteristic.AirQuality.EXCELLENT,
	1: Characteristic.AirQuality.GOOD,
	2: Characteristic.AirQuality.FAIR,
	3: Characteristic.AirQuality.INFERIOR,
	4: Characteristic.AirQuality.POOR
