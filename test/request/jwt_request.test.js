'use strict';

const bootstrap = require('../test_helper');
const JWT = require('../../lib/helpers/jwt');
const sinon = require('sinon');
const { expect } = require('chai');
const { parse } = require('url');

const route = '/auth';

describe('request parameter features', () => {
  const { provider, agent, wrap } = bootstrap(__dirname);
  const Client = provider.Client;
  provider.setupClient();
  provider.setupClient({
    client_id: 'client-with-HS-sig',
    client_secret: 'atleast32byteslongforHS256mmkay?',
    request_object_signing_alg: 'HS256',
    redirect_uris: ['https://client.example.com/cb'],
  });


  describe('configuration features.requestUri', () => {
    it('extends discovery', () => {
      return agent.get('/.well-known/openid-configuration')
      .expect(200)
      .expect((response) => {
        expect(response.body).to.have.property('request_parameter_supported', true);
      });
    });
  });

  ['get', 'post'].forEach((verb) => {
    describe(`${route} ${verb} passing request parameters as JWTs`, () => {
      before(agent.login);
      after(agent.logout);

      it('works with signed by none', function* () {
        const key = (yield Client.find('client-with-HS-sig')).keystore.get({ alg: 'HS256' });
        return JWT.sign({
          client_id: 'client-with-HS-sig',
          response_type: 'code',
          redirect_uri: 'https://client.example.com/cb'
        }, key, 'HS256').then(request =>
        wrap({
          agent,
          route,
          verb,
          auth: {
            request,
            scope: 'openid',
            client_id: 'client-with-HS-sig',
            response_type: 'code'
          }
        })
        .expect(302)
        .expect((response) => {
          const expected = parse('https://client.example.com/cb', true);
          const actual = parse(response.headers.location, true);
          ['protocol', 'host', 'pathname'].forEach((attr) => {
            expect(actual[attr]).to.equal(expected[attr]);
          });
          expect(actual.query).to.have.property('code');
        })
      );
      });

      it('works with signed by an actual alg', () => {
        return JWT.sign({
          client_id: 'client',
          response_type: 'code',
          redirect_uri: 'https://client.example.com/cb'
        }, null, 'none').then(request =>
        wrap({
          agent,
          route,
          verb,
          auth: {
            request,
            scope: 'openid',
            client_id: 'client',
            response_type: 'code'
          }
        })
        .expect(302)
        .expect((response) => {
          const expected = parse('https://client.example.com/cb', true);
          const actual = parse(response.headers.location, true);
          ['protocol', 'host', 'pathname'].forEach((attr) => {
            expect(actual[attr]).to.equal(expected[attr]);
          });
          expect(actual.query).to.have.property('code');
        })
      );
      });

      it('doesnt allow request inception', () => {
        const spy = sinon.spy();
        provider.once('authorization.error', spy);

        return JWT.sign({
          client_id: 'client',
          response_type: 'code',
          request: 'request inception',
          redirect_uri: 'https://client.example.com/cb'
        }, null, 'none').then(request =>
        wrap({
          agent,
          route,
          verb,
          auth: {
            request,
            scope: 'openid',
            client_id: 'client',
            response_type: 'code'
          }
        })
        .expect(302)
        .expect(() => {
          expect(spy.calledOnce).to.be.true;
          expect(spy.args[0][0]).to.have.property('message', 'invalid_request_object');
          expect(spy.args[0][0]).to.have.property('error_description',
            'request object must not contain request or request_uri properties');
        })
      );
      });

      it('doesnt allow requestUri inception', () => {
        const spy = sinon.spy();
        provider.once('authorization.error', spy);

        return JWT.sign({
          client_id: 'client',
          response_type: 'code',
          request_uri: 'request uri inception',
          redirect_uri: 'https://client.example.com/cb'
        }, null, 'none').then(request =>
        wrap({
          agent,
          route,
          verb,
          auth: {
            request,
            scope: 'openid',
            client_id: 'client',
            response_type: 'code'
          }
        })
        .expect(302)
        .expect(() => {
          expect(spy.calledOnce).to.be.true;
          expect(spy.args[0][0]).to.have.property('message', 'invalid_request_object');
          expect(spy.args[0][0]).to.have.property('error_description',
            'request object must not contain request or request_uri properties');
        })
      );
      });

      it('doesnt allow response_type to differ', () => {
        const spy = sinon.spy();
        provider.once('authorization.error', spy);

        return JWT.sign({
          client_id: 'client',
          response_type: 'id_token',
          redirect_uri: 'https://client.example.com/cb'
        }, null, 'none').then(request =>
        wrap({
          agent,
          route,
          verb,
          auth: {
            request,
            scope: 'openid',
            client_id: 'client',
            response_type: 'code'
          }
        })
        .expect(302)
        .expect(() => {
          expect(spy.calledOnce).to.be.true;
          expect(spy.args[0][0]).to.have.property('message', 'invalid_request_object');
          expect(spy.args[0][0]).to.have.property('error_description',
            'request response_type must equal the one in request parameters');
        })
      );
      });

      it('doesnt allow client_id to differ', () => {
        const spy = sinon.spy();
        provider.once('authorization.error', spy);

        return JWT.sign({
          client_id: 'client2',
          response_type: 'code',
          redirect_uri: 'https://client.example.com/cb'
        }, null, 'none').then(request =>
        wrap({
          agent,
          route,
          verb,
          auth: {
            request,
            scope: 'openid',
            client_id: 'client',
            response_type: 'code'
          }
        })
        .expect(302)
        .expect(() => {
          expect(spy.calledOnce).to.be.true;
          expect(spy.args[0][0]).to.have.property('message', 'invalid_request_object');
          expect(spy.args[0][0]).to.have.property('error_description',
            'request client_id must equal the one in request parameters');
        })
      );
      });

      it('handles invalid signed looklike jwts', () => {
        const spy = sinon.spy();
        provider.once('authorization.error', spy);

        return wrap({
          agent,
          route,
          verb,
          auth: {
            request: 'definitely.notsigned.jwt',
            scope: 'openid',
            client_id: 'client',
            response_type: 'code'
          }
        })
      .expect(302)
      .expect(() => {
        expect(spy.calledOnce).to.be.true;
        expect(spy.args[0][0]).to.have.property('message', 'invalid_request_object');
        expect(spy.args[0][0]).to.have.property('error_description').and.matches(
          /could not parse request_uri as valid JWT/
        );
      });
      });

      it('doesnt allow clients with predefined alg to bypass this alg', () => {
        const spy = sinon.spy();
        provider.once('authorization.error', spy);

        return JWT.sign({
          client_id: 'client-with-HS-sig',
          response_type: 'code',
          redirect_uri: 'https://client.example.com/cb'
        }, null, 'none').then(request =>
        wrap({
          agent,
          route,
          verb,
          auth: {
            request,
            scope: 'openid',
            client_id: 'client-with-HS-sig',
            response_type: 'code'
          }
        })
        .expect(302)
        .expect(() => {
          expect(spy.calledOnce).to.be.true;
          expect(spy.args[0][0]).to.have.property('message', 'invalid_request_object');
          expect(spy.args[0][0]).to.have.property('error_description',
            'the preregistered alg must be used in request or request_uri');
        })
      );
      });


      it('bad signatures will be rejected', function* () {
        const spy = sinon.spy();
        provider.once('authorization.error', spy);

        const key = (yield Client.find('client-with-HS-sig')).keystore.get({ alg: 'HS256' });
        return JWT.sign({
          client_id: 'client',
          response_type: 'code',
          redirect_uri: 'https://client.example.com/cb'
        }, key, 'HS256').then(request =>
        wrap({
          agent,
          route,
          verb,
          auth: {
            request,
            scope: 'openid',
            client_id: 'client',
            response_type: 'code'
          }
        })
        .expect(302)
        .expect(() => {
          expect(spy.calledOnce).to.be.true;
          expect(spy.args[0][0]).to.have.property('message', 'invalid_request_object');
          expect(spy.args[0][0]).to.have.property('error_description').that.matches(
            /could not validate request object signature/
          );
        })
      );
      });

      it('handles unrecognized parameters', function* () {
        const key = (yield Client.find('client-with-HS-sig')).keystore.get({ alg: 'HS256' });
        return JWT.sign({
          client_id: 'client-with-HS-sig',
          unrecognized: true,
          response_type: 'code',
          redirect_uri: 'https://client.example.com/cb'
        }, key, 'HS256').then(request =>
        wrap({
          agent,
          route,
          verb,
          auth: {
            request,
            scope: 'openid',
            client_id: 'client-with-HS-sig',
            response_type: 'code'
          }
        })
        .expect(302)
        .expect((response) => {
          const expected = parse('https://client.example.com/cb', true);
          const actual = parse(response.headers.location, true);
          ['protocol', 'host', 'pathname'].forEach((attr) => {
            expect(actual[attr]).to.equal(expected[attr]);
          });
          expect(actual.query).to.have.property('code');
        })
      );
      });
    });
  });
});
