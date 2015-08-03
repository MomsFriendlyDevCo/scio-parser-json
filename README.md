scio-parser-json
================

JSON config parser for [Scio](https://github.com/MomsFriendlyDevCo/Scio).


Translates a JSON blob like the below into a Scio schema:

	{
	  "google.com": {
	    "address": "google.com",
	    "services": [
	      "ping",
	      "http"
	    ]
	  },
	  "reddit.com": {
	    "address": "reddit.com",
	    "services": [
	      {
		"ping": {
		  "timeoutDanger": 300
		}
	      },
	      "http"
	    ]
	  }
	}

**NOTES**:

* Almost all properties of plugins are optional. if specified as strings (as `http` is above) all default options are assumed.
* `schedule` is processed by [human-to-cron](https://github.com/rainder/human-to-cron)
