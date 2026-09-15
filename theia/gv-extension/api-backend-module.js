const { ContainerModule } = require('@theia/core/shared/inversify');
const { BackendApplicationContribution } = require('@theia/core/lib/node/backend-application');
const { createStudioProxy } = require('../../backend/http/studio-proxy');
const express = require('express');
module.exports.default = new ContainerModule(bind => {
  bind(BackendApplicationContribution).toConstantValue({ configure(app) { app.use('/gv-api', express.raw({ type: 'application/json', limit: '16mb' }), createStudioProxy()); } });
});
