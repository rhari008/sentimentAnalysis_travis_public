'use strict';

var _ = require('lodash');
var assert = require('assert');
var util = require('util');
var jobsclient = require('@sap/jobs-client');
var EventEmitter = require('events').EventEmitter;

var XsjsJobRunner = require('./XsjsJobRunner');
var SqlScriptJobRunner = require('./SqlScriptJobRunner');

module.exports = JobManager;


util.inherits(JobManager, EventEmitter);

/**
 * @param {Object} jobServiceConfig - required, job scheduler config
 */
function JobManager(jobServiceConfig) {
  assert(_.isObject(jobServiceConfig), 'valid job scheduler config object required');
  assert(_.isString(jobServiceConfig.url), 'job sceduler config should contain valid "url" property');

  this._jc = jobServiceConfig;

  EventEmitter.call(this);
}

/**
 * Registers all jobs in Job Scheduler service asynchronously. Does not throw errors, 'registered' event is triggered with
 * error parameter having value <code>null</code> in case registration was successful or valid error otherwise
 */
JobManager.prototype.registerAllJobs = function (jobs, appConfig) {
  assert(_.isArray(jobs), 'Valid jobs array expected');
  assert(appConfig, 'Valid application config expected');

  var scheduler = new jobsclient.Scheduler(this._schedulerOptions());

  var self = this;
  jobs.forEach(function (job) {
    var jobsCallbackUrl = self._jc.jobsCallbackUrl || appConfig.url;
    var scJob = job.toSchedulerJob(appConfig.host, jobsCallbackUrl);
    var options = {
      name: scJob.name,
      job: scJob
    };

    scheduler.upsertJob(options, function (error, body) {
      if (!error) { job.id = body._id; }
      self.emit('register', error, job);
    });
  });
};

/**
 * Starts new job asynchronously, when job finished an event will be triggered
 * @param rt xsjs runtime
 * @param job the job to run
 * @param request http request object
 * @throws in case some of parameters is invalid
 */
JobManager.prototype.startJobAsync = function (rt, job, request) {
  assert(rt, 'Valid xsjs runtime object expected');
  assert(job, 'Valid job object expected');
  assert(request, 'Valid request object expected');

  var runnable = null;
  if (job.action.isJavaScript()) {
    runnable = this._createXsjsRunnable(rt, job, request);
  } else {
    runnable = this._createSqlProcRunnable(rt.get('hanaDbOptions').forRequest(request));
  }

  this._startJob(runnable, job, request);
};

JobManager.prototype._startJob = function (runnable, job, request) {
  var self = this;
  var inputParams = this._parseInput(request);
  var jobRunDetails = this._getJobRunDetails(request, job);

  process.nextTick(function () {
    try {
      runnable(job, inputParams, function (err) {
        self.emit('job-finished', err, job, jobRunDetails);
        self._sendJobFinished(err, job, jobRunDetails);
      });
    } catch (ex) {
      self.emit('job-finished', ex, job, jobRunDetails);
      self._sendJobFinished(ex, job, jobRunDetails);
    }
  });
};


JobManager.prototype._sendJobFinished = function (err, job, jobRunDetails) {
  var message = (!err) ? 'OK' : ('Job run failed, error: ' + err.message);
  var options = _.extend({}, jobRunDetails, {
    data: {
      success: !err,
      message: message
    }
  });

  var self = this;
  var scheduler = new jobsclient.Scheduler(this._schedulerOptions());
  scheduler.updateJobRunLog(options, function(err) {
    self.emit('status-update', err, job, jobRunDetails);
  });
};

JobManager.prototype._getJobRunDetails = function(request, job) {
  var jobRunDetails = {
    jobId: request.headers['x-sap-job-id'],
    scheduleId: request.headers['x-sap-job-schedule-id'],
    runId: request.headers['x-sap-job-run-id']
  };

  assert(jobRunDetails.jobId, 'Expecting job ID to be provided when starting JOB:' + job.name);
  assert(jobRunDetails.scheduleId, 'Expecting job schedule ID to be provided when starting JOB:' + job.name);
  assert(jobRunDetails.runId, 'Expecting job run ID to be provided when starting JOB:' + job.name);

  return jobRunDetails;
};

JobManager.prototype._schedulerOptions = function () {
  return _.extend(this._jc, {
    baseURL: this._jc.url
  });
};

JobManager.prototype._createXsjsRunnable = function (rt, job, req) {
  var runner = new XsjsJobRunner(rt);
  runner.prepare(job, req);

  return function xsjsRunnable(job, inputParams, done) {
    runner.run(inputParams, done);
  };
};

JobManager.prototype._createSqlProcRunnable = function (dbReqOptions) {
  return function SqlScriptRunnable(job, inputParams, done) {
    var runner = new SqlScriptJobRunner(dbReqOptions);
    runner.run(job, inputParams, done);
  };
};

JobManager.prototype._parseInput = function (request) {
  return request.body;
};
