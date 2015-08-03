var _ = require('lodash');
var async = require('async-chainable');
var fs = require('fs');

module.exports = {
	_scio: true,
	_name: 'scio-parser-json',
	parsers: [
		{
			ref: 'json',
			description: 'Parse JSON files',
			canParse: function(next, file) {
				return next(null, /\.json$/i.test(file.path));
			},
			callback: function(next, file, scio) {
				async()
					.set('created', {servers: 0, services: 0})
					// Read file {{{
					.then('raw', function(next) {
						fs.readFile(file, next);
					})
					.then('parsed', function(next) {
						try {
							var parsed = JSON.parse(this.raw);
							next(null, parsed);
						} catch (e) {
							return next('Error parsing ' + file + ' - ' + e);
						}
					})
					// }}}
					// Process {{{
					.then('taskExec', function(next) {
						// Prepare taskExec defer task {{{
						next(null, 
							async()
								.set('createdServers', {})
								.set('created', this.created)
						);
						// }}}
					})
					.then(function(next) {
						var taskExec = this.taskExec;
						if (!_.isObject(this.parsed)) return next('Config file contents is not an object');

						_.forEach(this.parsed, function(profile) {
							if (!_.isObject(profile)) return next('Profile is not an object');
							if (!profile.address) return next('Profile must have an .address property');
							if (!profile.services) return next('Profile contains no services: ' + profile.address);

							var createServer = {address: profile.address};
							['ref', 'name', 'status'].forEach(function(key) {
								if (profile[key]) createServer[key] = profile[key];
							});

							taskExec.defer(profile.address, function(nextDefer) {
								var created = this.created;
								var createdServers = this.createdServers;
								scio.models.Servers.create(createServer, function(err, built) {
									createdServers[profile.address] = built._id;
									created.servers++;
									return nextDefer();
								});
							});

							// Process services {{{
							_.forEach(profile.services, function(service) {
								var newService = {};
								if (_.isString(service)) {
									taskExec.defer([profile.address], function(next) {
										var created = this.created;
										scio.models.Services.create({
											server: this.createdServers[profile.address],
											plugin: service,
										}, function(err) {
											if (err) return next(err);
											created.services++;
											next();
										});
									});
									newService.plugin = service;
								} else if (_.isObject(service)) {
									_.forEach(service, function(options, plugin) {
										taskExec.defer([profile.address], function(next) {
											var created = this.created;
											var createService = {
												server: this.createdServers[profile.address],
												plugin: plugin,
											};
											// Read in meta options {{{
											['ref', 'name', 'schedule'].forEach(function(field) {
												if (options[field]) {
													createService[field] = options[field];
													delete createService[field];
												}
											});
											if (!createService.plugin) return next('Service must specify a plugin');
											if (createService.schedule) {
												createService.cronSchedule = humanToCron(options.schedule);
												if (!createService.cronSchedule) return next('Unparsable Cron-expression for profile ' + profile.address + '/' + createService.plugin);
											}
											// }}}
											createService.options = options;
											scio.Services.create(createService, function(err) {
												if (err) return next(err);
												created.services++;
												next();
											});
										});
									});
								} else {
									return next('Dont know how to handle specification for service in ' + profile.address);
								}
							});
							// }}}
						});
						next();
					})
					.then(function(next) {
						// Run the task processor to build the database
						console.log('BUILD!', this.taskExec._struct);
						this.taskExec
							.await()
							.end(next);
					})
					// }}}
					.end(function(err) {
						if (err) return next(err);
						console.log("PLUGIN END WITH", this.created);
						next(null, this.created);
					});
			},
		},
	],
};
