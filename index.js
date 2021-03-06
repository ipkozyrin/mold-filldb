import _ from 'lodash';


class Filler {
  constructor(mold, options) {
    this.mold = mold;
    this.schema = mold.$$schemaManager.getFullSchema();
    this.options = options || {};
  }

  // This method you run
  fillDb() {
    if (this.options.before) this.options.before();
    this._schemaRecursuveAdd('', this.schema);
    if (this.options.after) this.options.after();
  }

  _schemaRecursuveAdd(currentPath, schema) {
    if (!_.isPlainObject(schema)) return;
    _.each(schema, (item, name) => {
      const subPath = _.trimStart(`${currentPath}.${name}`, '.');

      // TODO: не привязываться к типу
      if (_.includes(['container', 'document'], item.type)) {
        if (this._isDataContainer(item.schema)) {
          this._fillContainer(subPath, item.schema);
        }
        // go deeper
        this._schemaRecursuveAdd(subPath + '.schema', item.schema);
      }
      else if (_.includes(['collection', 'documentsCollection', 'pagedCollection'], item.type)) {
        // TODO: а если нету item.dev???
        if (_.isPlainObject(item.dev) && _.isNumber(item.dev.repeat)) {
          this._fillCollection(subPath, item.dev.repeat, item.item);
        }
      }
    });
  }

  _getDev(dev) {
    if (_.isFunction(dev)) {
      return dev();
    }
    else if (_.isString(dev) || _.isNumber(dev)) {
      return dev;
    }
  }

  _convertSchemaPathToMold(schemaPath) {
    return schemaPath.replace(/.schema/, '');
  }

  _collectContainersData(currentPath, containerSchema, result) {
    _.each(containerSchema, (item, name) => {
      if (!_.isPlainObject(item)) return;
      const subPath = _.trimStart(`${currentPath}.${name}`, '.');
      // TODO: поддержка других типов - collection и тд
      if (item.type == 'container' || item.type == 'document') {
        this._collectContainersData(subPath, item.schema, result);
      }
      else if (_.includes(['string', 'number', 'boolean'], item.type)) {
        if (!item.dev) return;
        result.push([subPath, this._getDev(item.dev)]);
      }
    })
  }

  _prepareItem(itemSchema) {
    const container = {};

    // TODO: поддержка других типов - collection и тд
    if (itemSchema.type == 'document' || itemSchema.type == 'container') {
      const result = [];
      this._collectContainersData('', itemSchema.schema, result);
      _.each(result, (item) => {
        _.set(container, item[0], item[1]);
      });
    }

    return container;
   }

  _fillCollection(schemaPath, repeats, itemSchema) {
    const moldPath = this._convertSchemaPathToMold(schemaPath);

    for (let i=0; i < repeats; i++) {
      this.mold.child(moldPath).create(this._prepareItem(itemSchema));
    }
  }

  _fillContainer(schemaPath, schema) {
    const moldPath = this._convertSchemaPathToMold(schemaPath);

    const container = {};
    const result = [];
    this._collectContainersData('', schema, result);
    _.each(result, (item) => {
      _.set(container, item[0], item[1]);
    });

    const instance = this.mold.child(moldPath);
    instance.update(container);
    instance.put(container);
  }

  _isDataContainer(containerSchema) {
    return _.find(containerSchema, (item) => {
      if (item.dev && _.includes(['string', 'number', 'boolean'], item.type)) return item;
    });
  }

}

export default function (mold, options) {
  return new Filler(mold, options);
}
