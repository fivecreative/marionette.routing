(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('backbone.radio'), require('cherrytreex'), require('underscore'), require('backbone.marionette'), require('jquery')) :
  typeof define === 'function' && define.amd ? define(['exports', 'backbone.radio', 'cherrytreex', 'underscore', 'backbone.marionette', 'jquery'], factory) :
  (factory((global.Marionette = global.Marionette || {}, global.Marionette.Routing = {}),global.Backbone.Radio,global.Cherrytree,global._,global.Backbone.Marionette,global.$));
}(this, (function (exports,Radio,Cherrytree,_,backbone_marionette,$) { 'use strict';

  Radio = Radio && Radio.hasOwnProperty('default') ? Radio['default'] : Radio;
  Cherrytree = Cherrytree && Cherrytree.hasOwnProperty('default') ? Cherrytree['default'] : Cherrytree;
  _ = _ && _.hasOwnProperty('default') ? _['default'] : _;
  $ = $ && $.hasOwnProperty('default') ? $['default'] : $;










console.log('');










  function RouteContext(routes, route) {
    var routeIndex = routes.indexOf(route);
    this.parentRoutes = routes.slice(0, routeIndex)
  }

  RouteContext.prototype.trigger = function () {
    var parentRoutes = this.parentRoutes;
    for (var i = parentRoutes.length - 1; i >= 0; i--) {
      var channel = parentRoutes[i]._contextChannel;
      if (channel) {
        channel.trigger.apply(channel, arguments);
      }
    }
  };

  RouteContext.prototype.request = function (name) {
    var parentRoutes = this.parentRoutes;
    for (var i = parentRoutes.length - 1; i >= 0; i--) {
      var channel = parentRoutes[i]._contextChannel;
      if (channel && channel._requests[name]) {
        return channel.request.apply(channel, arguments);
      }
    }
  };

  /* global history */

  var mnRouteMap = Object.create(null);
  var routerChannel = Radio.channel('router');
  var router = void 0;

  function Router(options, renderRoot) {
    if (router) {
      throw new Error('Instance of router already created');
    }
    Cherrytree.call(this, options);
    this.middleware.push(middleware);
    if (renderRoot) {
      if (renderRoot instanceof backbone_marionette.Region) {
        this.rootRegion = renderRoot;
      } else {
        this.rootRegion = new backbone_marionette.Region({ el: renderRoot });
      }
    }
    router = this;
  }

  Router.prototype = Object.create(Cherrytree.prototype);
  Router.prototype.constructor = Router;

  Router.prototype.use = function (customMiddleware) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    var m = typeof customMiddleware === 'function' ? { next: customMiddleware } : customMiddleware;
    if (options.before) {
      this.middleware.splice(this.middleware.indexOf(middleware), 0, m);
    } else {
      this.middleware.push(m);
    }
    return this;
  };

  Router.prototype.destroy = function () {
    router = null;
    mnRouteMap = Object.create(null);
    Cherrytree.prototype.destroy.call(this);
  };

  function getMnRoutes(routes) {
    return routes.map(function (route) {
      return mnRouteMap[route.name];
    });
  }

  routerChannel.reply('transitionTo', function () {
    return router.transitionTo.apply(router, arguments);
  });

  routerChannel.reply('isActive', function () {
    return router.isActive.apply(router, arguments);
  });

  routerChannel.reply('generate', function () {
    return router.generate.apply(router, arguments);
  });

  routerChannel.reply('goBack', function () {
    // in wait of a better implementation
    history.back();
  });

  function getChangingIndex(prevRoutes, currentRoutes) {
    var index = void 0,
        prev = void 0,
        current = void 0;
    var count = Math.max(prevRoutes.length, currentRoutes.length);
    for (index = 0; index < count; index++) {
      prev = prevRoutes[index];
      current = currentRoutes[index];
      if (!(prev && current) || prev.name !== current.name || !_.isEqual(prev.params, current.params)) {
        break;
      }
    }
    return index;
  }

  function findRouteClass(options, routeName, index, routes) {
    var result = options.routeClass;
    // look in parent routes
    if (!result) {
      var parentRoutes = routes.slice(0, index).reverse().map(function (route) {
        return mnRouteMap[route.name];
      });
      parentRoutes.some(function (route) {
        var childRoutes = _.result(route, 'childRoutes');
        result = childRoutes && childRoutes[routeName];
        return result;
      });
    }
    return result;
  }

  function createRouteInstance(RouteClass, options, config) {
    var routeOptions = _.extend({}, options.routeOptions, _.pick(options, ['viewClass', 'viewOptions']));
    if (!RouteClass && routeOptions.viewClass) {
      RouteClass = Route;
    }
    if (RouteClass) {
      if (RouteClass.__esModule) RouteClass = RouteClass.default;
      return new RouteClass(routeOptions, router, config);
    }
  }

  function createMnRoute(route, index, routes) {
    var instanceConfig = {
      name: route.name,
      path: route.path,
      options: _.clone(route.options)
    };
    var RouteClass = findRouteClass(route.options, route.name, index, routes);
    if (_.isFunction(RouteClass) && !(RouteClass.prototype instanceof Route)) {
      // possible async route definition
      RouteClass = RouteClass.call(route);
      return Promise.resolve(RouteClass).then(function (result) {
        return result && createRouteInstance(result, route.options, instanceConfig);
      });
    }
    return createRouteInstance(RouteClass, route.options, instanceConfig);
  }

  function getParentRegion(routes, route) {
    var region = void 0,
        parent = void 0;
    var routeIndex = routes.indexOf(route) - 1;
    while (routeIndex >= 0) {
      parent = routes[routeIndex];
      if (parent.view && parent.$config.options.outlet !== false) {
        region = parent.getOutlet();
        if (region) {
          return region;
        } else {
          throw new Error('No outlet region defined in ' + parent.$config.name + ' route');
        }
      }
      routeIndex--;
    }
    return router.rootRegion;
  }

  function renderViews(mnRoutes, activated, transition) {
    // ensure at least the target (last) route is rendered
    var renderCandidates = activated.length ? activated : mnRoutes.slice(-1);

    var renderQueue = renderCandidates.reduce(function (memo, mnRoute) {
      if (mnRoute.viewClass) {
        if (memo.length && memo[memo.length - 1].$config.options.outlet === false) {
          memo.pop();
        }
        memo.push(mnRoute);
      }
      return memo;
    }, []);

    renderQueue.forEach(function (mnRoute) {
      var parentRegion = getParentRegion(mnRoutes, mnRoute);
      mnRoute.renderView(parentRegion, transition);
    });
  }

  var resolved = Promise.resolve();

  function runAsyncMethod(transition, routes, method) {
    return routes.reduce(function (prevPromise, mnRoute) {
      routerChannel.trigger('before:' + method, transition, mnRoute);
      return prevPromise.then(function () {
        if (!transition.isCancelled) {
          return Promise.resolve(mnRoute[method](transition)).then(function () {
            if (!transition.isCancelled) {
              routerChannel.trigger(method, transition, mnRoute);
            }
          });
        }
      });
    }, resolved);
  }

  function isActivatingRoute(route) {
    return this.activating && this.activating.indexOf(route) !== -1;
  }

  function isTargetRoute(route) {
    return this.mnRoutes && this.mnRoutes.indexOf(route) === this.mnRoutes.length - 1;
  }

  var middleware = {
    next: function routeResolver(transition) {
      transition.isActivating = isActivatingRoute;
      transition.isTarget = isTargetRoute;

      routerChannel.trigger('before:transition', transition);

      if (transition.isCancelled) return;

      var prevRoutes = transition.prev.routes;
      var changingIndex = getChangingIndex(prevRoutes, transition.routes);
      var deactivated = [];
      var routeIndex = void 0,
          routeInstance = void 0;

      // deactivate previous routes
      for (routeIndex = prevRoutes.length - 1; routeIndex >= changingIndex; routeIndex--) {
        routeInstance = mnRouteMap[prevRoutes[routeIndex].name];
        if (routeInstance) {
          deactivated.push(routeInstance);
        }
      }

      var promise = runAsyncMethod(transition, deactivated, 'deactivate');

      // build route tree and creating instances if necessary
      var mnRoutes = transition.mnRoutes = [];

      promise = promise.then(function () {
        return transition.routes.reduce(function (acc, route, i, routes) {
          return acc.then(function (res) {
            var instance = mnRouteMap[route.name];
            if (instance) {
              res.push(instance);
              return res;
            } else {
              instance = createMnRoute(route, i, routes);
              return Promise.resolve(instance).then(function (mnRoute) {
                if (!mnRoute) {
                  throw new Error('Unable to create route ' + route.name + ': routeClass or viewClass must be defined');
                }
                mnRouteMap[route.name] = mnRoute;
                res.push(mnRoute);
                return res;
              });
            }
          });
        }, Promise.resolve(mnRoutes));
      });

      // activate routes in order
      var activated = void 0;

      promise = promise.then(function () {
        activated = transition.activating = mnRoutes.slice(changingIndex);
        return runAsyncMethod(transition, activated, 'activate');
      });

      promise.catch(function () {
        // catch errors occurred inside routing classes / methods
        // Should be handled in error event or in a transition.catch method
      });

      // render views
      return promise.then(function () {
        if (transition.isCancelled) return;

        var loadPromise = mnRoutes.reduce(function (prevPromise, mnRoute) {
          var nextPromise = prevPromise;
          if (_.isFunction(mnRoute.load)) {
            if (prevPromise) {
              return prevPromise.then(function () {
                return Promise.resolve(mnRoute.load(transition));
              }).catch(function () {
                return Promise.resolve(mnRoute.load(transition));
              });
            } else {
              return Promise.resolve(mnRoute.load(transition));
            }
          }
          return nextPromise;
        }, undefined);

        if (loadPromise) {
          return new Promise(function (resolve) {
            loadPromise.then(function () {
              renderViews(mnRoutes, activated, transition);
              resolve();
            }).catch(function () {
              renderViews(mnRoutes, activated, transition);
              resolve();
            });
          });
        } else {
          renderViews(mnRoutes, activated, transition);
        }
      });
    },

    done: function done(transition) {
      router.state.mnRoutes = transition.mnRoutes;
      routerChannel.trigger('transition', transition);
    },

    cancel: function cancel(transition, err) {
      if (err.type !== 'TransitionRedirected') {
        routerChannel.trigger('transition:abort', transition, err);
      }
    },

    error: function error(transition, err) {
      routerChannel.trigger('transition:abort', transition, err);
      routerChannel.trigger('transition:error', transition, err);
    }
  };

  var Route = backbone_marionette.MnObject.extend({
    constructor: function constructor(options, router, config) {
      this.mergeOptions(options, ['viewClass', 'viewOptions']);
      this.$router = router;
      this.$config = config;
      backbone_marionette.MnObject.call(this, options);
      this._bindContext();
    },


    cidPrefix: 'rou',

    activate: function activate() {},
    deactivate: function deactivate() {},
    renderView: function renderView(region, transition) {
      if (this.view && this.updateView(transition)) return;
      var ViewClass = this.viewClass || backbone_marionette.View;
      var viewOptions = _.result(this, 'viewOptions', {});
      if (!(ViewClass.prototype instanceof backbone_marionette.View)) {
        if (_.isFunction(ViewClass)) {
          ViewClass = ViewClass.call(this);
        }
        if (!(ViewClass.prototype instanceof backbone_marionette.View)) {
          viewOptions = _.extend({}, ViewClass, viewOptions);
          ViewClass = backbone_marionette.View;
        }
      }
      var view = new ViewClass(viewOptions);
      this.listenToOnce(view, 'destroy', function () {
        if (this.viewEvents) {
          backbone_marionette.unbindEvents(this, this.view);
        }
        this.view = void 0;
      });
      if (region) {
        region.show(view);
      } else {
        // if region is undefined means no rootRegion is defined
        // accept a pre-rendered view in those situations throwing otherwise
        if (!view.isRendered()) throw new Error('No root outlet region defined');
      }
      this.view = view;
      routerChannel.trigger('route:render', this);
      if (this.viewEvents) {
        backbone_marionette.bindEvents(this, view, this.viewEvents);
      }
    },
    updateView: function updateView() {},
    getContext: function getContext() {
      // todo: cache context??
      var state = this.$router.state;
      var mnRoutes = (state.activeTransition || state).mnRoutes;
      if (!mnRoutes) {
        mnRoutes = getMnRoutes(state.routes);
      }
      return new RouteContext(mnRoutes, this);
    },
    getOutlet: function getOutlet() {
      return this.view.getRegion('outlet');
    },
    _bindContext: function _bindContext() {
      var requests = _.result(this, 'contextRequests');
      var events = _.result(this, 'contextEvents');
      var channel = void 0;
      if (!requests && !events) {
        return;
      }

      this._contextChannel = channel = new Radio.Channel('__routeContext_' + this.cid);

      this.bindRequests(channel, requests);
      this.bindEvents(channel, events);
    }
  });

  function attrChanged(mutations, observer) {
    mutations.forEach(function (mutation) {
      var attr = mutation.attributeName;
      if (attr.indexOf('param-') === 0 || attr.indexOf('query-') === 0) {
        updateHref(mutation.target, observer.link);
      }
    });
  }

  var attrObserverConfig = { attributes: true };

  function getAttributeValues(el, prefix, result) {
    var attributes = el.attributes;

    for (var i = 0; i < attributes.length; i++) {
      var attr = attributes[i];
      if (attr.name.indexOf(prefix) === 0) {
        var paramName = attr.name.slice(prefix.length);
        result[paramName] = attr.value;
      }
    }
    return result;
  }

  function updateHref(el, link) {
    var routeName = el.getAttribute('route');
    if (!routeName) return;
    var params = getAttributeValues(el, 'param-', link.getDefaults(routeName, 'params', el));
    var query = getAttributeValues(el, 'query-', link.getDefaults(routeName, 'query', el));
    var href = routerChannel.request('generate', routeName, params, query);
    var anchorEl = void 0;
    if (el.tagName === 'A') {
      anchorEl = el;
    } else {
      anchorEl = $(el).find('a').eq(0)[0];
    }
    if (anchorEl) anchorEl.setAttribute('href', href);
    return anchorEl;
  }

  function createLinks(routerLink) {
    var rootEl = routerLink.options.rootEl;
    var selector = rootEl ? rootEl + ' [route]' : '[route]';
    var $routes = routerLink.view.$(selector);

    $routes.each(function () {
      if (updateHref(this, routerLink)) {
        if (routerLink.attrObserver) routerLink.attrObserver.observe(this, attrObserverConfig);
      }
    });
  }

  var routerlink = backbone_marionette.Behavior.extend({
    events: {
      'click [route]:not(a)': 'onLinkClick'
    },

    onInitialize: function onInitialize(view) {
      this.listenTo(routerChannel, 'transition', this.onTransition);
      if (window.MutationObserver) {
        this.attrObserver = new window.MutationObserver(attrChanged);
        this.attrObserver.link = this;
      }
      if (view.isRendered()) createLinks(this);
    },
    onTransition: function onTransition() {
      var self = this;
      var rootEl = self.options.rootEl;
      var selector = rootEl ? rootEl + ' [route]' : '[route]';
      self.$(selector).each(function () {
        var $el = $(this);
        var routeName = $el.attr('route');
        if (!routeName) return;
        var params = getAttributeValues(this, 'param-', self.getDefaults(routeName, 'params', this));
        var query = getAttributeValues(this, 'query-', self.getDefaults(routeName, 'query', this));
        var activeClass = this.hasAttribute('active-class') ? $el.attr('active-class') : 'active';
        if (activeClass) {
          var isActive = routerChannel.request('isActive', routeName, params, query);
          $el.toggleClass(activeClass, isActive);
        }
      });
    },
    onLinkClick: function onLinkClick(e) {
      var el = e.currentTarget;
      if (this.$(el).find('a').length) return;
      var routeName = el.getAttribute('route');
      if (!routeName) return;
      var params = getAttributeValues(el, 'param-', this.getDefaults(routeName, 'params', el));
      var query = getAttributeValues(el, 'query-', this.getDefaults(routeName, 'query', el));
      routerChannel.request('transitionTo', routeName, params, query);
    },
    onRender: function onRender() {
      createLinks(this);
    },
    onDestroy: function onDestroy() {
      this.stopListening(routerChannel);
    },
    getDefaults: function getDefaults(routeName, prop, el) {
      var defaults = this.options.defaults;
      if (_.isFunction(defaults)) defaults = defaults.call(this.view);
      var routeDefaults = defaults && defaults[routeName];
      var result = routeDefaults && routeDefaults[prop];
      if (_.isFunction(result)) result = result.call(this.view, el);
      return _.clone(result) || {};
    },


    attrObserver: undefined
  });

  /**
   * Marionette Routing
   *
   * Copyright © 2015-2016 Luiz Américo Pereira Câmara. All rights reserved.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE.txt file in the root directory of this source tree.
   */

  exports.Route = Route;
  exports.RouterLink = routerlink;
  exports.Router = Router;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=marionette.routing.js.map
