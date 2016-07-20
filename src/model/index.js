/**
 * Functions to work with the TREsPASS model format.
 * @module trespass/model
 */

import update from 'immutability-helper';
const _ = require('lodash');
const R = require('ramda');
const revalidator = require('revalidator');
const async = require('async');
const moment = require('moment');
const xml2js = require('xml2js');
const pd = require('pretty-data').pd;


const attrKey = '_attr';
const charKey = '_text';
const xml2jsOptions = {
	attrkey: attrKey,
	charkey: charKey,
	trim: true,
	explicitArray: false,
};


const singularPluralCollection = [
	{
		origCollection: 'actors', // original collection name
		singular: 'actor',        //    ↓
		plural: 'actors',         // internal collection name
	},
	{
		singular: 'edge',
		plural: 'edges',
		origCollection: 'edges',
	},
	{
		singular: 'location',
		plural: 'locations',
		origCollection: 'locations',
	},
	{
		singular: 'policy',
		plural: 'policies',
		origCollection: 'policies',
	},
	{
		singular: 'predicate',
		plural: 'predicates',
		origCollection: 'predicates',
	},
	{
		singular: 'process',
		plural: 'processes',
		origCollection: 'processes',
	},
	{
		singular: 'item',
		plural: 'items',
		origCollection: 'assets',
	},
	{
		singular: 'data',
		plural: 'data',
		origCollection: 'assets',
	},
];

// collectionNamesSingular['items'] = 'item'
const collectionNamesSingular =
module.exports.collectionNamesSingular =
singularPluralCollection
	.reduce((result, item) => {
		result[item.plural] = item.singular;
		return result;
	}, {});
const collectionNames =
module.exports.collectionNames =
R.keys(collectionNamesSingular);


// ---
// ## `emptyModel`
// > model default structure
const emptyModel =
module.exports.emptyModel =
singularPluralCollection
	.map(R.prop('plural'))
	.reduce((result, collectionName) => {
		result.system[collectionName] = [];
		return result;
	},
	{
		system: {
			xmlns: 'https://www.trespass-project.eu/schemas/TREsPASS_model',
			'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
			'xsi:schemaLocation': 'https://www.trespass-project.eu/schemas/TREsPASS_model https://www.trespass-project.eu/schemas/TREsPASS_model.xsd',
			author: 'trespass.js',
			version: '0.0.0',
			title: 'Untitled',
			id: undefined,
			anm_data: undefined,
			date: undefined, // will be set on export
		}
	});


const create =
/**
 * creates new, empty model
 *
 * @returns {Object} model
 */
module.exports.create =
function create() {
	return _.merge({}, emptyModel);
};


// ---
// ## `emptyModel`
// > model default structure
const emptyScenario =
module.exports.emptyScenario = {
	scenario: {
		xmlns: 'https://www.trespass-project.eu/schemas/TREsPASS_scenario',
		'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
		'xsi:schemaLocation': 'https://www.trespass-project.eu/schemas/TREsPASS_scenario https://www.trespass-project.eu/schemas/TREsPASS_scenario.xsd',
		author: 'trespass.js',
		version: '0.0.0',
		id: undefined,
		date: undefined, // will be set on export

		model: undefined,

		assetGoal: {
			attacker: undefined,
			asset: undefined,
			profit: undefined,
		},

		// TODO: implement

		// locationGoal: {
		// 	attacker: undefined,
		// },

		// actionGoal: {
		// 	attacker: undefined,
		// 	credentials: [],
		// 	enabled: undefined
		// },
	},
};


const createScenario =
/**
 * creates new, empty scenario
 *
 * @returns {Object} scenario
 */
module.exports.createScenario =
function createScenario() {
	return _.merge({}, emptyScenario);
};

const scenarioSetModel =
/**
 * sets scenario model file name
 *
 * @param {Object} scenario - scenario object
 * @param {String} modelFileName - model file name
 * @returns {Object} scenario
 */
module.exports.scenarioSetModel =
function scenarioSetModel(scenario, modelFileName) {
	return update(
		scenario,
		{ scenario: { model: { $set: modelFileName } } }
	);
};

const scenarioSetAssetGoal =
/**
 * sets asset goal in scenario
 *
 * @param {Object} scenario - scenario object
 * @param {String} attackerId - attacker id
 * @param {String} assetId - asset id
 * @param {Number} [profit] - attacker profit
 * @returns {Object} scenario
 */
module.exports.scenarioSetAssetGoal =
function scenarioSetAssetGoal(scenario, attackerId, assetId, profit=0) {
	const goal = {
		profit,
		attacker: attackerId,
		asset: assetId,
	};
	return update(
		scenario,
		{ scenario: { assetGoal: { $set: goal } } }
	);
};

const scenarioToXML =
/**
 * renders a scenario object as xml string.
 *
 * @param {Object} _scenario - scenario object
 * @returns {String} scenario xml string
 */
module.exports.scenarioToXML =
function scenarioToXML(_scenario) {
	const scenario = _.merge({}, _scenario);

	scenario.scenario.date = (scenario.scenario.date || moment())
		.format('YYYY-MM-DD HH:mm:ss');

	if (!scenario.scenario.id) {
		throw new Error('scenario needs an id');
	}

	const prepared = prepareForXml(scenario);
	const builder = new xml2js.Builder(xml2jsOptions);
	const xmlStr = builder.buildObject(prepared);
	return xmlStr;
};


const singular =
/**
 * returns singular of given collection name.
 *
 * @param {String} plural
 * @returns {String} singular
 */
module.exports.singular =
function singular(plural) {
	return collectionNamesSingular[plural];
};


// TODO: how to properly document callbacks
// TODO: maybe change everything in here to use promises
const parse =
/**
 * parses a model xml string
 *
 * @param {String} xmlStr - attack tree xml string
 * @param {Function} done - callback
 * @returns {} callback signature is `(err, model)`
 */
module.exports.parse =
function parse(xmlStr, done) {
	function mergeAttributes(obj) {
		const attributes = obj[attrKey];
		const withoutAttributes = R.omit([attrKey], obj);
		return _.merge({}, withoutAttributes, attributes);
	}

	function recurse(item, trace=[]) {
		// console.log(trace);
		const key = R.last(trace);
		if (_.isArray(item)) {
			return item
				.map((arrItem, index) => {
					return recurse(arrItem, R.append(index, trace));
				});
		} else if (_.isString(item)) {
			item = item
				.replace(/[\r\n\t]/ig, ' ')
				.replace(/ +/ig, ' ');
			if (key === 'atLocations') {
				item = item.split(/ +/)
					.map(loc => {
						return loc.trim();
					})
					.filter(loc => {
						return !_.isEmpty(loc);
					});
			}
			if (R.nth(-4, trace) === 'predicate' && R.nth(-2, trace) === 'value') {
				item = item.split(/ +/);
			}
			return item;
		} else if (_.isNumber(item)) {
			return item;
		} else if (_.isObject(item)) {
			item = mergeAttributes(item);
			R.keys(item)
				.forEach((key) => {
					item[key] = recurse(item[key], R.append(key, trace));
				});
			return item;
		}
	}

	const model = create();
	let parsed;

	async.series(
		[
			(cb) => { // parse
				xml2js.parseString(xmlStr, xml2jsOptions, (err, _parsed) => {
					if (err) { return cb(err); }
					parsed = _parsed;
					cb(null);
				});
			},

			(cb) => { // metadata
				const metadata = parsed.system[attrKey];
				model.system = _.merge(model.system, metadata);
				cb(null);
			},

			(cb) => { // title
				model.system = _.merge(model.system, { title: parsed.system.title });
				cb(null, model);
			},

			(cb) => { // all the rest
				singularPluralCollection.forEach((item) => {
					let coll = parsed.system[item.origCollection];

					// this happens when
					// <locations>       </locations>
					if (_.isString(coll)) { // that's a bad sign
						coll = [];
					}
					if (coll) {
						if (!_.isArray(coll[item.singular])) {
							coll[item.singular] = [coll[item.singular]];
						}

						// filter, because for some reason
						// `coll[item.singular]` is [undefined] in some cases
						// TODO: find out why
						coll[item.singular] = coll[item.singular]
							.filter((item) => !!item);

						model.system[item.plural] = recurse(coll[item.singular], [item.singular]);
					}
				});

				if (model.system.anm_data) {
					model.system.anm_data = JSON.parse(model.system.anm_data);
				}

				cb(null, model);
			},
		],

		(err) => {
			if (err) { console.error(err); }
			done(err, model);
		}
	);
};


// element schema definitions for input validation
// const options = {
// 	atLocations: {
// 		language: {
// 			// label: ' ',
// 			any: { required: 'must be located somewhere' }
// 		}
// 	}
// };

/**
 * validation schemas for different model component types.
 */
const schemas = {};
schemas.location = {
	properties: {
		id: {
			type: 'string',
			required: true,
		},
		atLocations: {
			type: 'array',
			items: {
				// anyOf: [{ type: 'string' }],
				type: 'string',
			},
			required: false,
		},
		type: {
			type: 'string',
			required: false,
		},
	}
};
schemas.edge = {
	properties: {
		source: {
			type: 'string',
			required: true,
		},
		target: {
			type: 'string',
			required: true,
		},
		kind: {
			type: 'string',
			required: false,
		},
		directed: {
			type: 'boolean',
			required: false,
		},
	}
};
schemas.item = {
	properties: {
		id: {
			type: 'string',
			required: true,
		},
		name: {
			type: 'string',
			required: true,
		},
		type: {
			type: 'string',
			required: false,
		},
		atLocations: {
			type: 'array',
			items: {
				type: 'string',
			},
			minItems: 1,
			required: true,
		},
	}
};
schemas.data = {
	properties: {
		id: {
			type: 'string',
			required: true,
		},
		name: {
			type: 'string',
			required: true,
		},
		value: {
			type: 'string',
			required: true,
		},
		type: {
			type: 'string',
			required: false,
		},
		atLocations: {
			type: 'array',
			items: {
				type: 'string',
			},
			minItems: 1,
			required: true,
		},
	}
};
schemas.actor = {
	properties: {
		id: {
			type: 'string',
			required: true,
		},
		type: {
			type: 'string',
			required: false,
		},
		atLocations: {
			type: 'array',
			items: {
				type: 'string',
			},
			minItems: 1,
			required: true,
		},
	}
};
schemas.policy = {
	properties: {
		id: {
			type: 'string',
			required: true,
		},
		enabled: {
			type: 'object',
			required: true,
		},
		credentials: {
			type: 'object',
			required: true,
		},
		atLocations: {
			type: 'array',
			items: {
				type: 'string',
			},
			minItems: 1,
			required: true,
		},
	}
};
schemas.process = {
	properties: {
		id: {
			type: 'string',
			required: true,
		},
		actions: {
			type: 'object',
			required: true,
		},
		atLocations: {
			type: 'array',
			items: {
				type: 'string',
			},
			minItems: 1,
			required: true,
		},
	}
};
schemas.predicate = {
	properties: {
		id: {
			type: 'string',
			required: true,
		},
		arity: {
			type: 'number',
			required: true,
		},
		value: {
			type: 'array',
			items: {
				type: 'string',
			},
			minItems: 1,
			required: true,
		},
	}
};
schemas.metric = {
	properties: {
		name: {
			type: 'string',
			required: true,
		},
		value: {
			type: 'string',
			required: true,
		},
		namespace: {
			type: 'string',
			required: false,
		},
	}
};

const validationOptions = {
	additionalProperties: true,
};


const validateComponent =
/**
 * validates an object with a given schema.
 *
 * @param {Object} it
 * @param {String} schemaName name of [schema]{@link module:trespass/model.schemas} to use
 * @returns {Array} list of errors
 */
module.exports.validateComponent =
function validateComponent(it, schemaName) {
	const result = revalidator.validate(it, schemas[schemaName], validationOptions);
	/*
	{ valid: false,
	  errors:
	   [ { attribute: 'required',
	       property: 'name',
	       expected: true,
	       actual: undefined,
	       message: 'is required' },
	     { attribute: 'required',
	       property: 'age',
	       expected: true,
	       actual: undefined,
	       message: 'is required' } ] }
	*/

	if (!result.valid) {
		return result.errors
			.map((err) => {
				const label = it.name || it.id || `(unnamed ${schemaName})`;
				const message = (err.property === 'atLocations')
					? `${label} must be located somewhere`
					: `${label}: ${err.property} ${err.message}`;
				return { message };
			});
	}
	return [];
};


const validateModel =
/**
 * validate model
 *
 * @param {Object} model - model
 * @returns {Array} list of error objects
 */
module.exports.validateModel =
function validateModel(model) {
	let errors = [];
	collectionNames
		.forEach((collectionName) => {
			(model.system[collectionName] || [])
				.forEach((item) => {
					const schemaName = collectionNamesSingular[collectionName];
					errors = errors.concat(validateComponent(item, schemaName));
				});
		});
	return errors;
};


const add_ =
/**
 * @private
 */
module.exports.add_ =
function add_(model, dest, item) {
	const updateData = {
		[dest]: {
			$set: (!model.system[dest])
				? [item]
				: [...model.system[dest], item]
		}
	};
	return update(model, { system: updateData });
};


const addActor =
/**
 * add actor to model.
 *
 * @param {Object} model - model
 * @param {Object} _it - actor data
 * @returns {Object} model
 */
module.exports.addActor =
function addActor(model, _it={}) {
	const it = _.merge({}, _it);
	return add_(model, 'actors', it);
};


const addItem =
/**
 * add item to model.
 *
 * @param {Object} model - model
 * @param {Object} _it - item data
 * @returns {Object} model
 */
module.exports.addItem =
function addItem(model, _it={}) {
	const it = _.merge({}, _it);
	return add_(model, 'items', it);
};


const addData =
/**
 * add data to model.
 *
 * @param {Object} model - model
 * @param {Object} _it - data data
 * @returns {Object} model
 */
module.exports.addData =
function addData(model, _it={}) {
	const it = _.merge({}, _it);
	if (!it.name) {
		it.name = it.id;
	}
	return add_(model, 'data', it);
};


const addEdge =
/**
 * add edge to model.
 *
 * @param {Object} model - model
 * @param {Object} _it - edge data
 * @returns {Object} model
 */
module.exports.addEdge =
function addEdge(model, _it={}) {
	const it = _.merge({ directed: true }, _it);
	return add_(model, 'edges', it);
};


const addPolicy =
/**
 * add policy to model.
 *
 * @param {Object} model - model
 * @param {Object} _it - policy data
 * @returns {Object} model
 */
module.exports.addPolicy =
function addPolicy(model, _it={}) {
	const it = _.merge({}, _it);
	return add_(model, 'policies', it);
};


const addPredicate =
/**
 * add predicate to model.
 *
 * @param {Object} model - model
 * @param {Object} _it - predicate data
 * @returns {Object} model
 */
module.exports.addPredicate =
function addPredicate(model, _it={}) {
	const it = _.merge({}, _it);
	return add_(model, 'predicates', it);
};


const addProcess =
/**
 * add process to model.
 *
 * @param {Object} model - model
 * @param {Object} _it - process data
 * @returns {Object} model
 */
module.exports.addProcess =
function addProcess(model, _it={}) {
	const it = _.merge({}, _it);
	return add_(model, 'processes', it);
};


const addLocation =
/**
 * add location to model.
 *
 * @param {Object} model - model
 * @param {Object} _it - location data
 * @returns {Object} model
 */
module.exports.addLocation =
function addLocation(model, _it={}) {
	const it = _.merge({}, _it);
	return add_(model, 'locations', it);
};


const addRoom =
/**
 * @deprecated use [addLocation]{@link module:trespass/model.addLocation} instead
 */
module.exports.addRoom =
function addRoom(model, _it={}) {
	const it = _.merge({}, _it);
	console.warn('use addLocation() instead');
	return addLocation(model, it);
};


const separateAttributeFromObject =
/**
 * returns object and its attributes separately.
 *
 * @param {Array} attrNames - attribute names to extract
 * @param {Object} obj
 * @returns {Object} `{ newObject, attrObject }`
 */
module.exports.separateAttributeFromObject =
function separateAttributeFromObject(attrNames=[], obj) {
	const attrObject = R.pick(attrNames, obj);
	const newObject = R.pick(R.without(attrNames, R.keys(obj)), obj);
	return { newObject, attrObject };
};


const knownAttributes =
module.exports.knownAttributes = {
	// scenario
	scenario: ['xmlns', 'xmlns:xsi', 'xsi:schemaLocation', 'author', 'version', 'date', 'id'],
	assetGoal: ['attacker', 'profit'],
	// TODO: more

	// model
	system: ['xmlns', 'xmlns:xsi', 'xsi:schemaLocation', 'author', 'version', 'date', 'id', 'anm_data'],
	location: ['id', 'type', 'name'],
	actor: ['id', 'type', 'name'],
	edge: ['directed', 'kind'],
	item: ['id', 'name', 'type', 'type'],
	data: ['id', 'name', 'value', 'type'],
	credLocation: ['id'],
	credData: ['name'],
	credItem: ['name'],
	credPredicate: ['name'],
	process: ['id'],
	in: ['loc'],
	out: ['loc'],
	predicate: ['id', 'arity'],
	policy: ['id'],
	metric: ['namespace', 'name', 'value'],
};


const toPrefixedObject =
/**
 * puts `it` into an object, with property `prefix`.
 *
 * @param {String} prefix - property name
 * @param {} it - anything
 * @returns {Object}
 */
module.exports.toPrefixedObject =
function toPrefixedObject(prefix, it) {
	return { [prefix]: it };
};


const prepareForXml =
/**
 * recursively prepare object structure for conversion to xml.
 *
 * @param {Array|String|Object} it
 * @returns {Object}
 */
module.exports.prepareForXml =
function prepareForXml(it, parentKey) {
	if (_.isArray(it)) {
		return it.map((item) => {
			// put things back together
			if (parentKey === 'value' && _.isArray(item)) {
				item = item.join(' ');
			}

			return prepareForXml(item, parentKey);
		});
	} else if (_.isString(it) || _.isNumber(it)) {
		return it;
	} else if (_.isObject(it)) {
		// handle attributes
		if (parentKey && knownAttributes[parentKey]) {
			const { newObject, attrObject } =
				separateAttributeFromObject(knownAttributes[parentKey], it);
			it = _.merge(newObject, { [attrKey]: attrObject });
		}

		return R.keys(it)
			.reduce((result, key) => {
				if (key === attrKey) {
					result[key] = it[key];
					return result;
				}

				result[key] = prepareForXml(it[key], key);

				// put things back together
				if (key === 'atLocations') {
					result[key] = result[key].join(' ');
				}

				return result;
			}, {});
	}
};


const prepareModelForXml =
/**
 * prepares model object for conversion to xml.
 *
 * @param {Object} model - model object
 * @returns {Object} model
 */
module.exports.prepareModelForXml =
function prepareModelForXml(model) {
	// TODO: clone model?

	const system = model.system;

	const items = system.items || [];
	const data = system.data || [];
	delete system.items;
	delete system.data;

	collectionNames
		.forEach((collectionName) => {
			if (system[collectionName]) {
				system[collectionName] = toPrefixedObject(
					singular(collectionName),
					system[collectionName]
				);

				// remove empty ones
				if (!system[collectionName][singular(collectionName)].length) {
					delete system[collectionName];
				}
			}
		});

	system.assets = {
		data,
		item: items,
	};
	if (!system.assets.item.length) {
		delete system.assets.item;
	}

	if (!system.assets.data.length) {
		delete system.assets.data;
	}

	if (R.keys(system.assets).length === 0) {
		delete system.assets;
	}

	return model;
};


const toXML =
/**
 * renders a model object as xml string.
 *
 * @param {Object} _model - model object
 * @returns {String} model xml string
 */
module.exports.toXML =
function toXML(_model) {
	// duplicate model
	const model = _.merge({}, _model);

	if (!model.system.id) {
		throw new Error('`model.system` needs an id');
	}

	// set fill in the gaps with defaults
	model.system = _.defaults(model.system, {
		date: moment().format('YYYY-MM-DD HH:mm:ss'),
	});

	/*model = */prepareModelForXml(model);
	const preparedModel = prepareForXml(model);

	const builder = new xml2js.Builder(xml2jsOptions);
	const xmlStr = builder.buildObject(preparedModel);

	// return xmlStr;
	return pd.xml(xmlStr)
		.replace(/' {2}'/ig, '\t'); // spaces to tabs
};
