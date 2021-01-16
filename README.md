# homebridge-http-air-quality
HTTP Air quality accessory for Homebridge

## Sample config

	{
		"accessory": "HttpTemphum",
		"name": "Living Room Weather",
		"url": "http://192.168.1.210/weather",
		"httpMethod": "GET",
		"humidity": true,
		"cacheExpiration": 60
	}
