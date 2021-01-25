# homebridge-http-air-quality
HTTP Air quality accessory for Homebridge

## Sample config

Minimal:

	{
		"accessory": "HttpAirQuality",
		"name": "Air Quality",
		"url": "http://localhost/airquality"
	}

Full:

	{
		"accessory": "HttpAirQuality",
		"name": "Air Quality",
		"url": "http://localhost/airquality",
		"httpMethod": "GET",
		"httpTimeout": "3000", // in miliseconds
		"auth": {
			"user": "username",
			"pass": "password",
		},
		"pollingInterval": 300 // in seconds
	}

## Sample data

	{
		air_quality: 1,
		pm10: 32,
		pm25: 26,
		so2: 3,
		o3: 25,
		no2: 21,
		voc: 0.1
	}

All values are hourly values in µg/m³ and are optional. Only provided values will be used.

If you do not provide air_quality it will be calculated from other values.

## Air Quality value meaning

	0: EXCELLENT
	1: GOOD
	2: FAIR
	3: INFERIOR
	4: POOR
