import chai from 'chai';
import jsdom from 'mocha-jsdom';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {Route, createRouter, destroyRouter, middleware} from '../src/index';
import Mn from 'backbone.marionette';
import Backbone from 'backbone';

let expect = chai.expect;
chai.use(sinonChai);


let router, routes;
let RootRoute, ParentRoute, ChildRoute, GrandChildRoute, LeafRoute;

let ParentView = Mn.View.extend({
  template: function () {
    return '<div class="child-view"></div>'
  },
  regions: {
    outlet: '.child-view'
  }
});

let GrandChildView = Mn.View.extend({
  tagName: 'h2',
  template: function () {
    return 'GrandChild'
  }
});

let LeafView = Mn.View.extend({
  template: function () {
    return 'Leaf'
  }
});

describe('Render', () => {

  beforeEach(() => {
    router = createRouter({location: 'memory'});
    router.use(middleware);
    ParentRoute = Route.extend({
      viewClass: ParentView
    });
    RootRoute = Route.extend({}), ChildRoute = Route.extend({}),
      GrandChildRoute = Route.extend({}), LeafRoute = Route.extend({});
    routes = function (route) {
      route('parent', {routeClass: ParentRoute}, function () {
        route('child', {routeClass: ChildRoute}, function () {
          route('grandchild', {viewClass: GrandChildView}, function () {
            route('leaf', {routeClass: LeafRoute, viewClass: LeafView})
          })
        })
      });
      route('root', {routeClass: RootRoute, routeOptions: {viewClass: ParentView}});
      route('root2', {viewClass: ParentView})
    };
    router.map(routes);
    router.listen();
  });

  afterEach(() => {
    destroyRouter(router);
  });

  describe('viewClass', function () {
    let $;
    jsdom();

    before(function () {
      Backbone.$ = $ = require('jquery')(window)
    });

    beforeEach(function () {
      document.body.innerHTML = '<div id="main"></div>';
      let RootRegion = Mn.Region.extend({
        el: '#main'
      });
      router.rootRegion = new RootRegion()
    });

    it('can be defined in the Route class', function(done){
      router.transitionTo('parent').then(function () {
        expect($('#main').html()).to.be.equal('<div><div class="child-view"></div></div>');
        done()
      }).catch(done)
    });

    it('can be passed through routeOptions.viewClass', function(done){
      router.transitionTo('root').then(function () {
        expect($('#main').html()).to.be.equal('<div><div class="child-view"></div></div>');
        done()
      }).catch(done)
    });

    it('can be passed through viewClass, without a routeClass', function(done){
      router.transitionTo('root2').then(function () {
        expect($('#main').html()).to.be.equal('<div><div class="child-view"></div></div>');
        done()
      }).catch(done)
    });

    it('will propagate events defined in viewEvents to Route ', function (done) {
      let spy1 = sinon.spy()
      let spy2 = sinon.spy()
      RootRoute.prototype.viewEvents = {
        'my:event': function () {
          spy1()
        },
        'other:event': function () {
          spy1()
        }
      }
      router.transitionTo('root').then(function () {
        router.rootRegion.currentView.trigger('my:event')
        expect(spy1).to.be.calledOnce
        expect(spy2).to.not.be.called
        done()
      }).catch(done)

    });

    describe('of a root route', function () {

      it('should be rendered in rootRegion', function (done) {
        router.transitionTo('parent').then(function () {
          expect($('#main').html()).to.be.equal('<div><div class="child-view"></div></div>');
          done()
        }).catch(done)
      });

      it('should abort transition if no rootRegion is defined', function (done) {
        router.rootRegion = null;
        router.transitionTo('parent').then(function () {
          done('transition resolved')
        }).catch(function (error) {
          expect(error).to.be.an('error');
          expect(error.message).to.be.equal('No outlet region');
          done()
        })
      })
    });

    describe('of a child route', function () {

      it('should be rendered in the outlet region of the nearest route with a view', function (done) {
        router.transitionTo('grandchild').then(function () {
          expect($('#main').html()).to.be.equal('<div><div class="child-view"><h2>GrandChild</h2></div></div>');
          done()
        }).catch(done)
      });

      it('should abort transition if no outlet region is defined in the nearest route with a view', function (done) {
        router.transitionTo('leaf').then(function () {
          done('transition resolved')
        }).catch(function (error) {
          expect(error).to.be.an('error');
          expect(error.message).to.be.equal('No outlet region in view');
          done()
        })
      })

    })

    describe('of a target route', function () {

      it('should be rendered even if already activated', function () {
        let spy = sinon.spy(ParentView.prototype, 'render')
        return router.transitionTo('grandchild').then(function () {
          return router.transitionTo('parent')
        }).then(function () {
          expect(spy).to.be.calledTwice;
          expect($('#main').html()).to.be.equal('<div><div class="child-view"></div></div>');
        })
      });
    })

  })

});
  
