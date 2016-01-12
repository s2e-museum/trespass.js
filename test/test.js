'use strict';

var assert = require('assert');
var chalk = require('chalk');
var fs = require('fs');
var path = require('path');
// var libxml = require('libxmljs');

var rootDir = path.join(__dirname, '..');

var trespass = require('../');

var f1 = function(s) {
	return chalk.magenta(s);
};
var f2 = function(s) {
	return chalk.bgMagenta.black(s);
};
var f3 = function(s) {
	return chalk.bgMagenta.white(s);
};


// describe(f1('validation'), function() {

// 	describe(f2('model'), function() {
// 		it(f3('should be a valid document'), function() {
// 			var schemaContent = fs.readFileSync(
// 				path.join(rootDir, 'data', 'TREsPASS_model.xsd')
// 			).toString();
// 			var schema = libxml.parseXmlString(schemaContent);

// 			var modelContent = fs.readFileSync(
// 				path.join(rootDir, 'data', 'model_cloud_review.xml')
// 			).toString();
// 			var model = libxml.parseXmlString(modelContent);

// 			assert.equal(model.validate(schema), true);
// 		});
// 	});

// });


// ---
describe(f1('trespass.model'), function() {

	describe(f2('.children_to_obj()'), function() {
		it(f3('should be able to handle mixed case and hyphenated tag names'), function() {
			var $ = trespass.model.parse(
				'<edge>'+
					'<SOURCE>source</SOURCE>'+
					'<tarGet>tarGet</tarGet>'+
					'<un-related>un-related</un-related>'+
				'</edge>'
			);
			var $xml = $('edge');
			var result = trespass.util.children_to_obj($xml);
			assert(result['source']);
			assert(result['target']);
			assert(result['un-related']);
		});
	});


	// ---
	var modelXml = fs.readFileSync(
			path.join(rootDir, 'test', 'data', 'model_cloud_review.xml')
		).toString();

	describe(f2('.parse()'), function() {
		it(f3('should load correctly'), function() {
			var $system = trespass.model.parse(modelXml)('system');
			assert($system.attr().author === 'Christian W Probst');
			assert($system.find('locations > location').length === 22);
		});
	});

	describe(f2('.prepare()'), function() {
		it(f3('should properly transform xml $selection to js object'), function() {
			var $system = trespass.model.parse(modelXml)('system');
			var model = trespass.model.prepare($system);

			var locations = trespass.model.getLocations(model);
			assert(locations.length === 22);
			assert(locations[15].atLocations.length > 0);

			var data = trespass.model.getData(model);
			assert(data.length == 12);
		});
	});

	describe(f2('.xmlify()'), function() {
		it(f3('should properly transform object back to XML'), function() {
			var $system = trespass.model.parse(modelXml)('system');
			var model = trespass.model.prepare($system);
			var xmlStr = trespass.model.xmlify(model);

			$system = trespass.model.parse(xmlStr)('system');
			assert( $system.find('locations > location').length == 22 );
			assert( $system.find('edge > source').length == 26 );
			assert( $system.find('assets > item > atLocations').length == 7 );
			assert( $system.find('predicates > predicate').eq(1).find('value').length == 4 );
		});
	});

	describe(f2('.singular()'), function() {
		it(f3('should return known singular'), function() {
			var s = trespass.model.singular('policies');
			assert(s === 'policy');
		});

		it(f3('should return plural, if unknonw'), function() {
			var s = trespass.model.singular('hamburgers');
			assert(s === 'hamburgers');
		});
	});

	describe(f2('.create()'), function() {
		var model = trespass.model.create();
		assert(model.system.locations.length === 0);
		var $system, xmlStr;

		it(f3('should create a new model object'), function() {
			model = trespass.model.addRoom(model, { id: 'test-room' });
			xmlStr = trespass.model.xmlify(model);
			$system = trespass.model.parse(xmlStr)('system');
			assert( $system.find('locations > location').length === 1 );
		});

		it(f3('should create rooms'), function() {
			var label = 'at location';
			model = trespass.model.addRoom(model, {
				id: 'test-room-2',
				atLocations: [label]
			});
			xmlStr = trespass.model.xmlify(model);
			$system = trespass.model.parse(xmlStr)('system');
			assert( $system.find('locations > location').length === 2 );
			assert( $system.find('#test-room-2').text().trim() === label );
			assert( $system.find('#test-room-2 > atLocations').children().length === 0 );

			// var path = 'system.date'.split('.');
			// assert(model.getIn(path) != undefined);
		});

		it(f3('should create actors'), function() {
			model = trespass.model.addActor(model, {
				id: 'an-actor',
				atLocations: ['at location']
			});
			xmlStr = trespass.model.xmlify(model);
			$system = trespass.model.parse(xmlStr)('system');
			assert( $system.find('actors > actor').length === 1 );
		});

		it(f3('should validate input'), function() {
			var label = 'at location';
			assert.throws(function() {
				model = trespass.model.addRoom(model, {
					// missing `id`
				});
			});
			assert.throws(function() {
				model = trespass.model.addRoom(model, {
					domain: '!@#$'
				});
			});
		});
	});

});
