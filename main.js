"use strict";
exports.__esModule = true;
var xml2js = require("xml2js");
var lodash = require("lodash");
var commander = require("commander");
var fs = require("fs");
var GirModule = /** @class */ (function () {
    function GirModule(xml) {
        this.name = null;
        this.version = "0.0";
        this.dependencies = [];
        this.transitiveDependencies = [];
        this.symTable = {};
        this.patch = {};
        this.repo = xml.repository;
        if (this.repo.include) {
            for (var _i = 0, _a = this.repo.include; _i < _a.length; _i++) {
                var i = _a[_i];
                this.dependencies.unshift(i.$.name + "-" + i.$.version);
            }
        }
        if (this.repo.namespace && this.repo.namespace.length) {
            this.ns = this.repo.namespace[0];
            this.name = this.ns.$.name;
            this.version = this.ns.$.version;
        }
    }
    GirModule.prototype.loadTypes = function (dict) {
        var _this = this;
        var loadTypesInternal = function (arr) {
            if (arr) {
                for (var _i = 0, arr_1 = arr; _i < arr_1.length; _i++) {
                    var x = arr_1[_i];
                    if (x.$) {
                        if (x.$.introspectable) {
                            if (!_this.girBool(x.$.introspectable, true))
                                continue;
                        }
                    }
                    var symName = _this.name + "." + x.$.name;
                    if (dict[symName]) {
                        console.warn("Warn: duplicate symbol: " + symName);
                    }
                    x._module = _this;
                    x._fullSymName = symName;
                    dict[symName] = x;
                }
            }
        };
        loadTypesInternal(this.ns.bitfield);
        loadTypesInternal(this.ns.callback);
        loadTypesInternal(this.ns["class"]);
        loadTypesInternal(this.ns.constant);
        loadTypesInternal(this.ns.enumeration);
        loadTypesInternal(this.ns["function"]);
        loadTypesInternal(this.ns.interface);
        loadTypesInternal(this.ns.record);
        loadTypesInternal(this.ns.union);
        loadTypesInternal(this.ns.alias);
        var annotateFunctionArguments = function (f) {
            var funcName = f._fullSymName;
            if (f.parameters)
                for (var _i = 0, _a = f.parameters; _i < _a.length; _i++) {
                    var p = _a[_i];
                    if (p.parameter)
                        for (var _b = 0, _c = p.parameter; _b < _c.length; _b++) {
                            var x = _c[_b];
                            x._module = _this;
                            if (x.$ && x.$.name) {
                                x._fullSymName = funcName + "." + x.$.name;
                            }
                        }
                }
        };
        var annotateFunctionReturn = function (f) {
            var retVal = f["return-value"];
            if (retVal)
                for (var _i = 0, retVal_1 = retVal; _i < retVal_1.length; _i++) {
                    var x = retVal_1[_i];
                    x._module = _this;
                    if (x.$ && x.$.name) {
                        x._fullSymName = f._fullSymName + "." + x.$.name;
                    }
                }
        };
        var annotateFunctions = function (obj, funcs) {
            if (funcs)
                for (var _i = 0, funcs_1 = funcs; _i < funcs_1.length; _i++) {
                    var f = funcs_1[_i];
                    var nsName = obj ? obj._fullSymName : _this.name;
                    f._fullSymName = nsName + "." + f.$.name;
                    annotateFunctionArguments(f);
                    annotateFunctionReturn(f);
                }
        };
        var annotateVariables = function (obj, vars) {
            if (vars)
                for (var _i = 0, vars_1 = vars; _i < vars_1.length; _i++) {
                    var x = vars_1[_i];
                    var nsName = obj ? obj._fullSymName : _this.name;
                    x._module = _this;
                    if (x.$ && x.$.name) {
                        x._fullSymName = nsName + "." + x.$.name;
                    }
                }
        };
        if (this.ns.callback)
            for (var _i = 0, _a = this.ns.callback; _i < _a.length; _i++) {
                var f = _a[_i];
                annotateFunctionArguments(f);
            }
        var objs = (this.ns["class"] ? this.ns["class"] : []).concat(this.ns.record ? this.ns.record : []).concat(this.ns.interface ? this.ns.interface : []);
        for (var _b = 0, objs_1 = objs; _b < objs_1.length; _b++) {
            var c = objs_1[_b];
            c._module = this;
            c._fullSymName = this.name + "." + c.$.name;
            annotateFunctions(c, c["function"] || []);
            annotateFunctions(c, c.method || []);
            annotateFunctions(c, c["virtual-method"] || []);
            annotateFunctions(c, c["glib:signal"] || []);
            annotateVariables(c, c.property);
            annotateVariables(c, c.field);
        }
        if (this.ns["function"])
            annotateFunctions(null, this.ns["function"]);
        if (this.ns.constant)
            annotateVariables(null, this.ns.constant);
        // if (this.ns.)
        // props
        this.symTable = dict;
    };
    GirModule.prototype.loadInheritance = function (inheritanceTable) {
        // Class hierarchy
        for (var _i = 0, _a = (this.ns["class"] ? this.ns["class"] : []); _i < _a.length; _i++) {
            var cls = _a[_i];
            var parent_1 = void 0;
            if (cls.$ && cls.$.parent)
                parent_1 = cls.$.parent;
            if (!parent_1)
                continue;
            if (!cls._fullSymName)
                continue;
            if (parent_1.indexOf(".") < 0) {
                parent_1 = this.name + "." + parent_1;
            }
            var clsName = cls._fullSymName;
            var arr = inheritanceTable[clsName] || [];
            arr.push(parent_1);
            inheritanceTable[clsName] = arr;
        }
        // Class interface implementations
        for (var _b = 0, _c = (this.ns["class"] ? this.ns["class"] : []); _b < _c.length; _b++) {
            var cls = _c[_b];
            if (!cls._fullSymName)
                continue;
            var names = [];
            for (var _d = 0, _e = (cls.implements ? cls.implements : []); _d < _e.length; _d++) {
                var i = _e[_d];
                if (i.$.name) {
                    var name_1 = i.$.name;
                    if (name_1.indexOf(".") < 0) {
                        name_1 = cls._fullSymName.substring(0, cls._fullSymName.indexOf(".") + 1) + name_1;
                    }
                    names.push(name_1);
                }
            }
            if (names.length > 0) {
                var clsName = cls._fullSymName;
                var arr = inheritanceTable[clsName] || [];
                inheritanceTable[clsName] = arr.concat(names);
            }
        }
    };
    GirModule.prototype.typeLookup = function (e) {
        var type;
        var arr = '';
        var arrCType;
        var nul = '';
        var collection = e.array
            ? e.array
            : (e.type && /^GLib.S?List$/.test(e.type[0].$.name))
                ? e.type
                : undefined;
        if (collection && collection.length > 0) {
            var typeArray = collection[0].type;
            if (typeArray == null || typeArray.length == 0)
                return 'any';
            if (collection[0].$) {
                var ea = collection[0].$;
                arrCType = ea['c:type'];
            }
            type = typeArray[0];
            arr = '[]';
        }
        else if (e.type)
            type = e.type[0];
        else
            return "any";
        if (e.$) {
            var nullable = this.girBool(e.$.nullable) || this.girBool(e.$["allow-none"]);
            if (nullable) {
                nul = ' | null';
            }
        }
        if (!type.$)
            return 'any';
        var suffix = arr + nul;
        if (arr) {
            var podTypeMapArray = {
                'guint8': 'Gjs.byteArray.ByteArray',
                'gint8': 'Gjs.byteArray.ByteArray',
                'gunichar': 'string'
            };
            if (podTypeMapArray[type.$.name] != null)
                return podTypeMapArray[type.$.name] + nul;
        }
        var podTypeMap = {
            'utf8': 'string', 'none': 'void', 'double': 'number', 'guint32': 'number',
            'guint16': 'number', 'gint16': 'number', 'gunichar': 'number',
            'gint8': 'number', 'gint32': 'number', 'gushort': 'number', 'gfloat': 'number',
            'gboolean': 'boolean', 'gpointer': 'object', 'gchar': 'number',
            'guint': 'number', 'glong': 'number', 'gulong': 'number', 'gint': 'number',
            'guint8': 'number', 'guint64': 'number', 'gint64': 'number',
            'gdouble': 'number', 'gssize': 'number', 'gsize': 'number', 'long': 'number',
            'object': 'any', 'va_list': 'any', 'gshort': 'number'
        };
        if (podTypeMap[type.$.name] != null)
            return podTypeMap[type.$.name] + suffix;
        if (!this.name)
            return "any";
        var cType = type.$['c:type'];
        if (!cType)
            cType = arrCType;
        if (cType) {
            var cTypeMap = {
                'char*': 'string',
                'gchar*': 'string',
                'gchar**': 'any',
                'GType': (this.name == 'GObject' ? 'Type' : 'GObject.Type') + suffix
            };
            if (cTypeMap[cType]) {
                return cTypeMap[cType];
            }
        }
        var fullTypeName = type.$.name;
        var fullTypeMap = {
            'GObject.Value': 'any',
            'GObject.Closure': 'Function',
            'GLib.ByteArray': 'Gjs.byteArray.ByteArray',
            'GLib.Bytes': 'Gjs.byteArray.ByteArray'
        };
        if (fullTypeName && fullTypeMap[fullTypeName]) {
            return fullTypeMap[fullTypeName];
        }
        // Fully qualify our type name if need be
        if (fullTypeName && fullTypeName.indexOf(".") < 0) {
            var mod = this;
            if (e._module)
                mod = e._module;
            fullTypeName = mod.name + "." + type.$.name;
        }
        if (!fullTypeName || this.symTable[fullTypeName] == null) {
            console.warn("Could not find type " + fullTypeName + " for " + e.$.name);
            return "any" + arr;
        }
        if (fullTypeName.indexOf(this.name + ".") == 0) {
            var ret = fullTypeName.substring(this.name.length + 1);
            // console.warn(`Rewriting ${fullTypeName} to ${ret} + ${suffix} -- ${this.name} -- ${e._module}`)
            if (fullTypeName == 'Gio.ApplicationFlags') {
                debugger;
            }
            return ret + suffix;
        }
        return fullTypeName + suffix;
    };
    GirModule.prototype.girBool = function (e, defaultVal) {
        if (defaultVal === void 0) { defaultVal = false; }
        if (e) {
            if (parseInt(e) == 0)
                return false;
            return true;
        }
        return defaultVal;
    };
    GirModule.prototype.getReturnType = function (e) {
        var returnType;
        var returnVal = e["return-value"] ? e["return-value"][0] : undefined;
        if (returnVal) {
            returnType = this.typeLookup(returnVal);
        }
        else
            returnType = "void";
        var outArrayLengthIndex = returnVal.array && returnVal.array[0].$.length
            ? Number(returnVal.array[0].$.length)
            : -1;
        return [returnType, outArrayLengthIndex];
    };
    GirModule.prototype.arrayLengthIndexLookup = function (param) {
        if (!param.array)
            return -1;
        var arr = param.array[0];
        if (!arr.$)
            return -1;
        if (arr.$.length) {
            return parseInt(arr.$.length);
        }
        return -1;
    };
    GirModule.prototype.closureDataIndexLookup = function (param) {
        if (!param.$.closure)
            return -1;
        return parseInt(param.$.closure);
    };
    GirModule.prototype.destroyDataIndexLookup = function (param) {
        if (!param.$.destroy)
            return -1;
        return parseInt(param.$.destroy);
    };
    GirModule.prototype.getParameters = function (parameters, outArrayLengthIndex) {
        var def = [];
        var outParams = [];
        if (parameters && parameters.length > 0) {
            var parametersArray_1 = parameters[0].parameter;
            if (parametersArray_1) {
                var skip_1 = outArrayLengthIndex === -1
                    ? []
                    : [parametersArray_1[outArrayLengthIndex]];
                var processParams = function (getIndex) {
                    for (var _i = 0, _a = parametersArray_1; _i < _a.length; _i++) {
                        var param = _a[_i];
                        var index = getIndex(param);
                        if (index < 0)
                            continue;
                        if (index >= parametersArray_1.length)
                            continue;
                        skip_1.push(parametersArray_1[index]);
                    }
                };
                processParams(this.arrayLengthIndexLookup);
                processParams(this.closureDataIndexLookup);
                processParams(this.destroyDataIndexLookup);
                var _loop_1 = function (param) {
                    var paramName = this_1.fixVariableName(param.$.name || '-', false);
                    var paramType = this_1.typeLookup(param);
                    if (skip_1.indexOf(param) !== -1) {
                        return "continue";
                    }
                    var optDirection = param.$.direction;
                    if (optDirection) {
                        if (optDirection == 'out') {
                            outParams.push("/* " + paramName + " */ " + paramType);
                            return "continue";
                        }
                    }
                    var allowNone = param.$["allow-none"] ? "?" : "";
                    if (allowNone) {
                        var index = parametersArray_1.indexOf(param);
                        var following = parametersArray_1.slice(index)
                            .filter(function (p) { return skip_1.indexOf(param) === -1; })
                            .filter(function (p) { return p.$.direction !== "out"; });
                        if (following.some(function (p) { return !p.$["allow-none"]; })) {
                            allowNone = "";
                        }
                    }
                    var paramDesc = "" + paramName + allowNone + ": " + paramType;
                    def.push(paramDesc);
                };
                var this_1 = this;
                for (var _i = 0, _a = parametersArray_1; _i < _a.length; _i++) {
                    var param = _a[_i];
                    _loop_1(param);
                }
            }
        }
        return [def.join(", "), outParams];
    };
    GirModule.prototype.fixVariableName = function (name, allowQuotes) {
        var reservedNames = {
            'in': 1, 'function': 1, 'true': 1, 'false': 1, 'break': 1,
            'arguments': 1, 'eval': 1, 'default': 1, 'new': 1
        };
        // GJS always re-writes - to _ (I think?)
        name = name.replace(/-/g, "_");
        if (reservedNames[name]) {
            if (allowQuotes)
                return "\"" + name + "\"";
            else
                return name + "_";
        }
        return name;
    };
    GirModule.prototype.getVariable = function (v, optional, allowQuotes) {
        if (optional === void 0) { optional = false; }
        if (allowQuotes === void 0) { allowQuotes = false; }
        if (!v.$.name)
            return [[], null];
        if (!v || !v.$ || !this.girBool(v.$.introspectable, true) ||
            this.girBool(v.$.private))
            return [[], null];
        var name = this.fixVariableName(v.$.name, allowQuotes);
        var typeName = this.typeLookup(v);
        var nameSuffix = optional ? "?" : "";
        return [["" + name + nameSuffix + ":" + typeName], name];
    };
    GirModule.prototype.getProperty = function (v, construct) {
        if (construct === void 0) { construct = false; }
        if (this.girBool(v.$["construct-only"]) && !construct)
            return [[], null, null];
        if (!this.girBool(v.$.writable) && construct)
            return [[], null, null];
        if (this.girBool(v.$.private))
            return [[], null, null];
        var propPrefix = this.girBool(v.$.writable) ? '' : 'readonly ';
        var _a = this.getVariable(v, construct, true), propDesc = _a[0], propName = _a[1];
        if (!propName)
            return [[], null, null];
        return [["    " + propPrefix + propDesc], propName, v.$.name || null];
    };
    GirModule.prototype.exportEnumeration = function (e) {
        var def = [];
        if (!e || !e.$ || !this.girBool(e.$.introspectable, true))
            return [];
        def.push("export enum " + e.$.name + " {");
        if (e.member) {
            for (var _i = 0, _a = e.member; _i < _a.length; _i++) {
                var member = _a[_i];
                var name_2 = member.$.name.toUpperCase();
                if (/\d/.test(name_2[0]))
                    def.push("    /* " + name_2 + " (invalid, starts with a number) */");
                else
                    def.push("    " + name_2 + ",");
            }
        }
        def.push("}");
        return def;
    };
    GirModule.prototype.exportConstant = function (e) {
        var _a = this.getVariable(e), varDesc = _a[0], varName = _a[1];
        if (varName)
            return ["export const " + varDesc];
        return [];
    };
    GirModule.prototype.getFunction = function (e, prefix, funcNamePrefix) {
        if (funcNamePrefix === void 0) { funcNamePrefix = null; }
        if (!e || !e.$ || !this.girBool(e.$.introspectable, true) || e.$["shadowed-by"])
            return [[], null];
        var patch = e._fullSymName ? this.patch[e._fullSymName] : [];
        var name = e.$.name;
        var _a = this.getReturnType(e), retType = _a[0], outArrayLengthIndex = _a[1];
        var _b = this.getParameters(e.parameters, outArrayLengthIndex), params = _b[0], outParams = _b[1];
        if (e.$["shadows"]) {
            name = e.$["shadows"];
        }
        if (funcNamePrefix)
            name = funcNamePrefix + name;
        if (e._fullSymName == 'Gtk.Container.child_notify') {
            debugger;
        }
        if (patch && patch.length === 1)
            return [patch, null];
        var reservedWords = {
            'false': 1, 'true': 1, 'break': 1
        };
        if (reservedWords[name])
            return [["/* Function '" + name + "' is a reserved word */"], null];
        if (patch && patch.length === 2)
            return [["" + prefix + funcNamePrefix + patch[patch.length - 1]], name];
        var retTypeIsVoid = retType == 'void';
        if (outParams.length + (retTypeIsVoid ? 0 : 1) > 1) {
            if (!retTypeIsVoid) {
                outParams.unshift("/* returnType */ " + retType);
            }
            var retDesc = outParams.join(', ');
            retType = "[ " + retDesc + " ]";
        }
        else if (outParams.length == 1 && retTypeIsVoid) {
            retType = outParams[0];
        }
        return [["" + prefix + name + "(" + params + "): " + retType], name];
    };
    GirModule.prototype.getConstructorFunction = function (name, e, prefix, funcNamePrefix) {
        if (funcNamePrefix === void 0) { funcNamePrefix = null; }
        var _a = this.getFunction(e, prefix, funcNamePrefix), desc = _a[0], funcName = _a[1];
        if (!funcName)
            return [[], null];
        var retType = this.getReturnType(e)[0];
        if (retType.split(' ')[0] != name) {
            // console.warn(`Constructor returns ${retType} should return ${name}`)
            // Force constructors to return the type of the class they are actually
            // constructing. In a lot of cases the GI data says they return a base
            // class instead; I'm not sure why.
            e["return-value"] = [
                {
                    '$': {
                    // nullable
                    },
                    'type': [{ '$': {
                                name: name
                            } }
                    ]
                }
            ];
            desc = this.getFunction(e, prefix)[0];
        }
        return [desc, funcName];
    };
    GirModule.prototype.getSignalFunc = function (e, clsName) {
        var sigName = e.$.name;
        var _a = this.getReturnType(e), retType = _a[0], outArrayLengthIndex = _a[1];
        var _b = this.getParameters(e.parameters, outArrayLengthIndex), params = _b[0], outParams = _b[1];
        var paramComma = params.length > 0 ? ', ' : '';
        return ["    connect(sigName: \"" + sigName + "\", callback: ((obj: " + clsName + paramComma + params + ") => " + retType + ")): void"];
    };
    GirModule.prototype.exportFunction = function (e) {
        return this.getFunction(e, "export function ")[0];
    };
    GirModule.prototype.exportCallback = function (e) {
        if (!e || !e.$ || !this.girBool(e.$.introspectable, true))
            return [];
        var name = e.$.name;
        var _a = this.getReturnType(e), retType = _a[0], outArrayLengthIndex = _a[1];
        var _b = this.getParameters(e.parameters, outArrayLengthIndex), params = _b[0], outParams = _b[1];
        var def = [];
        def.push("export interface " + name + " {");
        def.push("    (" + params + "): " + retType);
        def.push("}");
        return def;
    };
    GirModule.prototype.traverseInheritanceTree = function (e, callback) {
        if (!e || !e.$)
            return;
        var parent = undefined;
        var parentModule = undefined;
        var mod = e._module ? e._module : this;
        var name = e.$.name;
        if (name.indexOf(".") < 0) {
            name = mod.name + "." + name;
        }
        if (e.$.parent) {
            var parentName = e.$.parent;
            var origParentName = parentName;
            if (parentName.indexOf(".") < 0) {
                parentName = mod.name + "." + parentName;
            }
            var parentPtr = this.symTable[parentName];
            if (!parentPtr && origParentName == "Object") {
                parentPtr = this.symTable["GObject.Object"];
            }
            if (parentPtr) {
                parent = parentPtr;
            }
        }
        // console.log(`${e.$.name} : ${parent && parent.$ ? parent.$.name : 'none'} : ${parentModule ? parentModule.name : 'none'}`)
        callback(e);
        if (parent)
            this.traverseInheritanceTree(parent, callback);
    };
    GirModule.prototype.forEachInterface = function (e, callback) {
        for (var _i = 0, _a = e.implements || []; _i < _a.length; _i++) {
            var $ = _a[_i].$;
            var name_3 = $.name;
            if (name_3.indexOf(".") < 0) {
                name_3 = this.name + "." + name_3;
            }
            var iface = this.symTable[name_3];
            if (iface) {
                callback(iface);
            }
        }
    };
    GirModule.prototype.isDerivedFromGObject = function (e) {
        var ret = false;
        this.traverseInheritanceTree(e, function (cls) {
            if (cls._fullSymName == "GObject.Object") {
                ret = true;
            }
        });
        return ret;
    };
    GirModule.prototype.exportObjectInternal = function (e) {
        var _this = this;
        var name = e.$.name;
        var def = [];
        var isDerivedFromGObject = this.isDerivedFromGObject(e);
        if (e.$ && e.$["glib:is-gtype-struct-for"]) {
            return [];
        }
        var checkName = function (desc, name, localNames) {
            if (!desc || desc.length == 0)
                return [[], false];
            if (!name) {
                // console.error(`No name for ${desc}`)
                return [[], false];
            }
            if (localNames[name]) {
                // console.warn(`Name ${name} already defined (${desc})`)
                return [[], false];
            }
            localNames[name] = 1;
            return [desc, true];
        };
        var parentName = null;
        var counter = 0;
        this.traverseInheritanceTree(e, function (cls) {
            if (counter++ != 1)
                return;
            parentName = cls._fullSymName || null;
        });
        var parentNameShort = parentName || '';
        if (parentNameShort && this.name) {
            var s = parentNameShort.split(".", 2);
            if (s[0] === this.name) {
                parentNameShort = s[1];
            }
        }
        // Properties for construction
        if (isDerivedFromGObject) {
            var ext = ' ';
            if (parentName)
                ext = "extends " + parentNameShort + "_ConstructProps ";
            def.push("export interface " + name + "_ConstructProps " + ext + "{");
            var constructPropNames = {};
            if (e.property) {
                for (var _i = 0, _a = e.property; _i < _a.length; _i++) {
                    var p = _a[_i];
                    var _b = this.getProperty(p, true), desc = _b[0], name_4 = _b[1];
                    def = def.concat(checkName(desc, name_4, constructPropNames)[0]);
                }
            }
            def.push("}");
        }
        // Instance side
        def.push("export class " + name + " {");
        var localNames = {};
        var propertyNames = [];
        var copyProperties = function (cls) {
            if (cls.property) {
                def.push("    /* Properties of " + cls._fullSymName + " */");
                for (var _i = 0, _a = cls.property; _i < _a.length; _i++) {
                    var p = _a[_i];
                    var _b = _this.getProperty(p), desc = _b[0], name_5 = _b[1], origName = _b[2];
                    var _c = checkName(desc, name_5, localNames), aDesc = _c[0], added = _c[1];
                    if (added) {
                        if (origName)
                            propertyNames.push(origName);
                    }
                    def = def.concat(aDesc);
                }
            }
        };
        this.traverseInheritanceTree(e, copyProperties);
        this.forEachInterface(e, copyProperties);
        // Fields
        var copyFields = function (cls) {
            if (cls.field) {
                def.push("    /* Fields of " + cls._fullSymName + " */");
                for (var _i = 0, _a = cls.field; _i < _a.length; _i++) {
                    var f = _a[_i];
                    var _b = _this.getVariable(f, false, false), desc = _b[0], name_6 = _b[1];
                    var _c = checkName(desc, name_6, localNames), aDesc = _c[0], added = _c[1];
                    if (added) {
                        def.push("    " + aDesc[0]);
                    }
                }
            }
        };
        this.traverseInheritanceTree(e, copyFields);
        // Instance methods
        var copyMethods = function (cls) {
            if (cls.method) {
                def.push("    /* Methods of " + cls._fullSymName + " */");
                for (var _i = 0, _a = cls.method; _i < _a.length; _i++) {
                    var f = _a[_i];
                    var _b = _this.getFunction(f, "    "), desc = _b[0], name_7 = _b[1];
                    def = def.concat(checkName(desc, name_7, localNames)[0]);
                }
            }
        };
        this.traverseInheritanceTree(e, copyMethods);
        this.forEachInterface(e, copyMethods);
        // Instance methods, vfunc_ prefix
        this.traverseInheritanceTree(e, function (cls) {
            var vmeth = cls["virtual-method"];
            if (vmeth) {
                def.push("    /* Virtual methods of " + cls._fullSymName + " */");
                for (var _i = 0, vmeth_1 = vmeth; _i < vmeth_1.length; _i++) {
                    var f = vmeth_1[_i];
                    var _a = _this.getFunction(f, "    ", "vfunc_"), desc = _a[0], name_8 = _a[1];
                    desc = checkName(desc, name_8, localNames)[0];
                    if (desc[0]) {
                        desc[0] = desc[0].replace("(", "?(");
                    }
                    def = def.concat(desc);
                }
            }
        });
        var copySignals = function (cls) {
            var signals = cls["glib:signal"];
            if (signals) {
                def.push("    /* Signals of " + cls._fullSymName + " */");
                for (var _i = 0, signals_1 = signals; _i < signals_1.length; _i++) {
                    var s = signals_1[_i];
                    def = def.concat(_this.getSignalFunc(s, name));
                }
            }
        };
        this.traverseInheritanceTree(e, copySignals);
        this.forEachInterface(e, copySignals);
        if (isDerivedFromGObject) {
            var prefix = "GObject.";
            if (this.name == "GObject")
                prefix = "";
            for (var _c = 0, propertyNames_1 = propertyNames; _c < propertyNames_1.length; _c++) {
                var p = propertyNames_1[_c];
                def.push("    connect(sigName: \"notify::" + p + "\", callback: ((obj: " + name + ", pspec: " + prefix + "ParamSpec) => void)): void");
            }
            def.push("    connect(sigName: string, callback: any): void");
        }
        // TODO: Records have fields
        // Static side: default constructor
        def.push("    static name: string");
        if (isDerivedFromGObject) {
            def.push("    constructor (config?: " + name + "_ConstructProps)");
        }
        else {
            var constructor_ = (e['constructor'] || []);
            if (constructor_) {
                for (var _d = 0, constructor_1 = constructor_; _d < constructor_1.length; _d++) {
                    var f = constructor_1[_d];
                    var _e = this.getConstructorFunction(name, f, "    static "), desc = _e[0], funcName = _e[1];
                    if (!funcName)
                        continue;
                    if (funcName != "new")
                        continue;
                    def = def.concat(desc);
                    var jsStyleCtor = desc[0]
                        .replace("static new", "constructor")
                        .replace(/:[^:]+$/, "");
                    def = def.concat(jsStyleCtor);
                }
            }
        }
        // Static methods
        if (true) {
            var stc = [];
            var constructor_ = (e['constructor'] || []);
            if (constructor_) {
                for (var _f = 0, constructor_2 = constructor_; _f < constructor_2.length; _f++) {
                    var f = constructor_2[_f];
                    var _g = this.getConstructorFunction(name, f, "    static "), desc = _g[0], funcName = _g[1];
                    if (!funcName)
                        continue;
                    stc = stc.concat(desc);
                }
            }
            if (e["function"])
                for (var _h = 0, _j = e["function"]; _h < _j.length; _h++) {
                    var f = _j[_h];
                    var _k = this.getFunction(f, "    static "), desc = _k[0], funcName = _k[1];
                    if (funcName === "new")
                        continue;
                    stc = stc.concat(desc);
                }
            if (stc.length > 0) {
                def = def.concat(stc);
            }
        }
        def.push("}");
        return def;
    };
    GirModule.prototype.exportAlias = function (e) {
        if (!e || !e.$ || !this.girBool(e.$.introspectable, true))
            return [];
        var typeName = this.typeLookup(e);
        var name = e.$.name;
        return ["type " + name + " = " + typeName];
    };
    GirModule.prototype.exportInterface = function (e) {
        return this.exportObjectInternal(e);
    };
    GirModule.prototype.exportClass = function (e) {
        return this.exportObjectInternal(e);
    };
    GirModule.prototype.exportJs = function (outStream) {
        outStream.write("module.exports = imports.gi." + this.name);
    };
    GirModule.prototype["export"] = function (outStream) {
        var out = [];
        out.push("/**");
        out.push(" * " + this.name + "-" + this.version);
        out.push(" */");
        out.push("");
        var deps = this.transitiveDependencies;
        // Always pull in GObject, as we may need it for e.g. GObject.type
        if (this.name != 'GObject') {
            if (!lodash.find(deps, function (x) { return x == 'GObject'; })) {
                deps.push('GObject');
            }
        }
        out.push("import * as Gjs from './Gjs'");
        for (var _i = 0, deps_1 = deps; _i < deps_1.length; _i++) {
            var d = deps_1[_i];
            var base = d.split('-')[0];
            out.push("import * as " + base + " from './" + base + "'");
        }
        if (this.ns.enumeration)
            for (var _a = 0, _b = this.ns.enumeration; _a < _b.length; _a++) {
                var e = _b[_a];
                out = out.concat(this.exportEnumeration(e));
            }
        if (this.ns.bitfield)
            for (var _c = 0, _d = this.ns.bitfield; _c < _d.length; _c++) {
                var e = _d[_c];
                out = out.concat(this.exportEnumeration(e));
            }
        if (this.ns.constant)
            for (var _e = 0, _f = this.ns.constant; _e < _f.length; _e++) {
                var e = _f[_e];
                out = out.concat(this.exportConstant(e));
            }
        if (this.ns["function"])
            for (var _g = 0, _h = this.ns["function"]; _g < _h.length; _g++) {
                var e = _h[_g];
                out = out.concat(this.exportFunction(e));
            }
        if (this.ns.callback)
            for (var _j = 0, _k = this.ns.callback; _j < _k.length; _j++) {
                var e = _k[_j];
                out = out.concat(this.exportCallback(e));
            }
        if (this.ns.interface)
            for (var _l = 0, _m = this.ns.interface; _l < _m.length; _l++) {
                var e = _m[_l];
                out = out.concat(this.exportInterface(e));
            }
        if (this.ns["class"])
            for (var _o = 0, _p = this.ns["class"]; _o < _p.length; _o++) {
                var e = _p[_o];
                out = out.concat(this.exportInterface(e));
            }
        if (this.ns.record)
            for (var _q = 0, _r = this.ns.record; _q < _r.length; _q++) {
                var e = _r[_q];
                out = out.concat(this.exportInterface(e));
            }
        if (this.ns.union)
            for (var _s = 0, _t = this.ns.union; _s < _t.length; _s++) {
                var e = _t[_s];
                out = out.concat(this.exportInterface(e));
            }
        if (this.ns.alias)
            for (var _u = 0, _v = this.ns.alias; _u < _v.length; _u++) {
                var e = _v[_u];
                out = out.concat(this.exportAlias(e));
            }
        outStream.write(out.join("\n"));
    };
    return GirModule;
}());
exports.GirModule = GirModule;
function exportGjs(outDir, girModules) {
    if (!outDir)
        return;
    fs.createWriteStream(outDir + "/Gjs.d.ts").write("export namespace byteArray {\n    export class ByteArray {\n        constructor(len: number)\n        toGBytes(): any  // GLib.Bytes?\n        length: number\n    }\n    export function fromString(input: string): ByteArray\n    export function fromArray(input: number[]): ByteArray\n    export function fromGBytes(input: any): ByteArray\n    export function toString(x: ByteArray): string\n}\nexport namespace console {\n    export function interact(): void\n}\nexport namespace Lang {\n    // TODO: There is a lot more in Lang\n    export function Class(props: any): void\n}\nexport namespace gettext {\n    export enum LocaleCategory {\n        ALL, COLLATE, CTYPE, MESSAGES, MONETARY, NUMERIC, TIME\n    }\n    export function setlocale(category: number, locale: string|null): string\n    export function textdomain(domainname: string|null): string\n    export function bindtextdomain(domainname: string, dirname: string|null): string\n    export function gettext(msgid: string): string\n    export function dgettext(domainname: string|null, msgid: string): string\n    export function dcgettext(domainname: string|null, msgid: string, category: number): string\n    export function ngettext(msgid: string, msgid_plural: string, n: number): string\n    export function dngettext(domainname: string, msgid: string, msgid_plural: string, n: number): string\n    export function domain(domainName: string): { gettext: ((msgid: string) => string), ngettext: ((msgid: string, msgid_plural: string, n:number) => string), pgettext: ((context: any, msgid: string) => any) }\n}\nexport namespace Format {\n    export function vprintf(str: string, args: string[]): string\n    export function printf(fmt: string, ...args: any[]): void\n    // Following docs from gjs/modules/format.js\n    /** \n     * This function is intended to extend the String object and provide\n     * an String.format API for string formatting.\n     * It has to be set up using String.prototype.format = Format.format;\n     * Usage:\n     * \"somestring %s %d\".format('hello', 5);\n     * It supports %s, %d, %x and %f, for %f it also support precisions like\n     * \"%.2f\".format(1.526). All specifiers can be prefixed with a minimum\n     * field width, e.g. \"%5s\".format(\"foo\"). Unless the width is prefixed\n     * with '0', the formatted string will be padded with spaces.\n     */\n    export function format(fmt: string, ...args: any[]): string\n}\nexport namespace Mainloop {\n    export function quit(name: string): void\n    export function idle_source(handler: any, priority: number): any\n    export function idle_add(handler: any, priority: number): any\n    export function timeout_source(timeout: any, handler: any, priority: number): any\n    export function timeout_seconds_source(timeout: any, handler: any, priority: number): any\n    export function timeout_add(timeout: any, handler: any, priority: number): any\n    export function timeout_add_seconds(timeout: any, handler: any, priority: number): any\n    export function source_remove(id: any): any\n    export function run(name: string): void\n}\n");
    fs.createWriteStream(outDir + "/Gjs.js").write("module.exports = {\n    byteArray: imports.byteArray,\n    Lang: imports.lang,\n    Format: imports.format,\n    Mainloop: imports.mainloop,\n    gettext: imports.gettext\n}");
    var keys = lodash.keys(girModules).map(function (key) { return key.split("-")[0]; });
    // Breaks dependent app with error TS2383 if directly in global.
    // https://github.com/Microsoft/TypeScript/issues/16430
    fs.createWriteStream(outDir + "/print.d.ts").write("declare function print(...args: any[]): void");
    fs.createWriteStream(outDir + "/index.js").write("");
    fs.createWriteStream(outDir + "/index.d.ts").write("/// <reference path=\"print.d.ts\" />\n\nimport * as Gjs from \"./Gjs\";\n" + keys.map(function (key) { return "import * as " + key + " from \"./" + key + "\";"; }).join("\n") + "\n\ndeclare global {\n    function printerr(...args: any[]): void\n    function log(message?: string): void\n    function logError(exception: any, message?: string): void\n    const ARGV: string[]\n    const imports: typeof Gjs & {\n        [key: string]: any\n        gi: {\n" + keys.map(function (key) { return "            " + key + ": typeof " + key; }).join("\n") + "\n        }\n        searchPath: string[]\n    }\n}\n\nexport { }");
}
function exportExtra(outDir, inheritanceTable) {
    if (!outDir)
        return;
    var def = [];
    def.push("import * as GObject from './GObject'");
    def.push("");
    def.push("let inheritanceTable = {");
    for (var _i = 0, _a = lodash.keys(inheritanceTable); _i < _a.length; _i++) {
        var k = _a[_i];
        var arr = "'" + inheritanceTable[k].join("', '") + "'";
        def.push("    '" + k + "': [ " + arr + " ],");
    }
    def.push("}");
    def.push("");
    def.push("\ninterface StaticNamed {\n    name: string\n}\n\n/** Casts between derived classes, performing a run-time type-check\n * and raising an exception if the cast fails. Allows casting to implemented\n * interfaces, too.\n */\nexport function giCast<T>(from_: GObject.Object, to_: StaticNamed): T {\n    let desc: string = from_.toString()\n    let clsName: string|null = null\n    for (let k of desc.split(\" \")) {\n        if (k.substring(0, 7) == \"GIName:\") {\n            clsName = k.substring(7)\n            break\n        }\n    }\n    let toName = to_.name.replace(\"_\", \".\")\n\n    if (toName === clsName)\n        return ((from_ as any) as T)\n\n    if (clsName) {\n        let parents = inheritanceTable[clsName]\n        if (parents) {\n            if (parents.indexOf(toName) >= 0)\n                return ((from_ as any) as T)\n        }\n    }\n\n    throw Error(\"Invalid cast of \" + desc + \"(\" + clsName + \") to \" + toName)\n}    \n");
    fs.createWriteStream(outDir + "/cast.ts").write(def.join("\n"));
}
function finaliseInheritance(inheritanceTable) {
    for (var _i = 0, _a = lodash.keys(inheritanceTable); _i < _a.length; _i++) {
        var clsName = _a[_i];
        var p = inheritanceTable[clsName][0];
        while (p) {
            p = inheritanceTable[p];
            if (p) {
                p = p[0];
                inheritanceTable[clsName].push(p);
            }
        }
    }
}
function main() {
    commander
        .option("-g --gir-directory [directory]", "GIR directory", "/usr/share/gir-1.0")
        .option("-m --module [module]", "GIR modules to load, e.g. 'Gio-2.0'. May be specified multiple " +
        "times", function (val, lst) { lst.push(val); return lst; }, [])
        .option("-o --outdir [dir]", "Directory to output to", null)
        .parse(process.argv);
    var girModules = {};
    var girDirectory = commander.girDirectory;
    var girToLoad = commander.module;
    if (girToLoad.length == 0) {
        console.error("Need to specify modules via -m!");
        return;
    }
    while (girToLoad.length > 0) {
        var name_9 = girToLoad.shift();
        var fileName = girDirectory + "/" + name_9 + ".gir";
        console.log("Parsing " + fileName + "...");
        var fileContents = fs.readFileSync(fileName, 'utf8');
        xml2js.parseString(fileContents, function (err, result) {
            if (err) {
                console.error("ERROR: " + err);
                return;
            }
            var gi = new GirModule(result);
            if (!gi.name)
                return;
            girModules[gi.name + "-" + gi.version] = gi;
            for (var _i = 0, _a = gi.dependencies; _i < _a.length; _i++) {
                var dep = _a[_i];
                if (!girModules[dep] && lodash.indexOf(girToLoad, dep) < 0) {
                    girToLoad.unshift(dep);
                }
            }
        });
    }
    //console.dir(girModules["GObject-2.0"], { depth: null })
    console.log("Files parsed, loading types...");
    var symTable = {};
    for (var _i = 0, _a = lodash.values(girModules); _i < _a.length; _i++) {
        var k = _a[_i];
        k.loadTypes(symTable);
    }
    var inheritanceTable = {};
    for (var _b = 0, _c = lodash.values(girModules); _b < _c.length; _b++) {
        var k = _c[_b];
        k.loadInheritance(inheritanceTable);
    }
    finaliseInheritance(inheritanceTable);
    //console.dir(inheritanceTable)
    // Figure out transitive module dependencies
    var modDependencyMap = {};
    for (var _d = 0, _e = lodash.values(girModules); _d < _e.length; _d++) {
        var k = _e[_d];
        modDependencyMap[k.name || '-'] = lodash.map(k.dependencies || [], function (val) {
            return val.split('-')[0];
        });
    }
    var traverseDependencies = function (name, ret) {
        var deps = modDependencyMap[name];
        for (var _i = 0, deps_2 = deps; _i < deps_2.length; _i++) {
            var a = deps_2[_i];
            if (ret[a])
                continue;
            ret[a] = 1;
            traverseDependencies(a, ret);
        }
    };
    for (var _f = 0, _g = lodash.values(girModules); _f < _g.length; _f++) {
        var k = _g[_f];
        var ret = {};
        traverseDependencies(k.name, ret);
        k.transitiveDependencies = lodash.keys(ret);
    }
    var patch = {
        "Atk.Object.get_description": [
            "/* return type clashes with Atk.Action.get_description */",
            "get_description(): string | null"
        ],
        "Atk.Object.get_name": [
            "/* return type clashes with Atk.Action.get_name */",
            "get_name(): string | null"
        ],
        "Atk.Object.set_description": [
            "/* return type clashes with Atk.Action.set_description */",
            "set_description(description: string): boolean | null"
        ],
        'Gtk.Container.child_notify': [
            '/* child_notify clashes with Gtk.Widget.child_notify */'
        ],
        'Gtk.MenuItem.activate': [
            '/* activate clashes with Gtk.Widget.activate */'
        ],
        'Gtk.TextView.get_window': [
            '/* get_window clashes with Gtk.Widget.get_window */'
        ],
        'WebKit.WebView.get_settings': [
            '/* get_settings clashes with Gtk.Widget.get_settings */'
        ]
    };
    console.log("Types loaded, generating .d.ts...");
    for (var _h = 0, _j = lodash.keys(girModules); _h < _j.length; _h++) {
        var k = _j[_h];
        var outf = process.stdout;
        if (commander.outdir) {
            var outdir = commander.outdir;
            var name_10 = girModules[k].name || 'unknown';
            var fileName = outdir + "/" + name_10 + ".d.ts";
            outf = fs.createWriteStream(fileName);
        }
        console.log(" - " + k + " ...");
        girModules[k].patch = patch;
        girModules[k]["export"](outf);
        if (commander.outdir) {
            var outdir = commander.outdir;
            var name_11 = girModules[k].name || 'unknown';
            var fileName = outdir + "/" + name_11 + ".js";
            outf = fs.createWriteStream(fileName);
        }
        girModules[k].exportJs(outf);
    }
    // GJS internal stuff
    exportGjs(commander.outdir, girModules);
    exportExtra(commander.outdir, inheritanceTable);
    console.log("Done.");
}
if (require.main === module)
    main();
