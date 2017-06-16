'use strict';

var path = require('path');
var util = require('util');
var assert = require('assert');
var utils = require('../../utils');
var jobsClient = require('@sap/jobs-client');

var Schedules = require('./Schedules');
var Schedule = require('./Schedule');

module.exports = Job;

function Job(runtime, constructJob) {
  this._scheduler = createScheduler(runtime);

  this.schedules = {};
  if (!constructJob.uri) {
    throw new Error('Job: uri string parameter required');
  }
  var jobPath = resolveJobURI(runtime, constructJob.uri);
  var jobName = runtime.getJobName(jobPath);
  var job = this._scheduler.sync.fetchJob({
    name: jobName,
    displaySchedules: true
  });

  assert(job._id, 'Scheduler response missing _id property');
  assert(job.schedules, 'Scheduler response missing schedules property');

  this._jobId = job._id;
  this.active = job.active;

  var jobSchedules = job.schedules;
  var schedulesObject = new Schedules(this._scheduler, this._jobId);
  for (var k = 0; k < jobSchedules.length; k++) {
    assert(jobSchedules[k].scheduleId, 'Scheduler response missing scheduleId property');
    var description = jobSchedules[k].description;
    var data = jobSchedules[k].data;
    var cron = jobSchedules[k].cron;
    var active = jobSchedules[k].active;
    var scheduleId = jobSchedules[k].scheduleId;
    schedulesObject[scheduleId] = new Schedule(this._scheduler,
        description, data, cron, active, this._jobId, scheduleId);
  }
  this.schedules = schedulesObject;
}

Object.defineProperty(Job.prototype, 'deactivate', {
  enumerable : false,
  value : deactivate
});
Object.defineProperty(Job.prototype, 'activate', {
  enumerable : false,
  value : activate
});
Object.defineProperty(Job.prototype, 'configure', {
  enumerable : false,
  value : configure
});


function resolveJobURI(runtime, uri) {
  if (!/\.xsjob$/.test(uri)) {
    throw new Error('URI ' + uri + ' should reference a xsjob');
  }
  var jobPath;
  if (uri[0] === '/') {
    jobPath = uri;
  } else {
    // uri is relative to calling xsjs
    var callingXsjs = utils.getCallingXsjsRelativePath(runtime.get('rootDirs'));
    var dir = path.dirname(callingXsjs);
    jobPath = path.normalize('/' + dir + '/' + uri).replace(/\\/g, '/');
  }
  if (!(jobPath in runtime.xsjobs)) {
    throw new Error('Could not find job ' + jobPath);
  }
  return jobPath;
}

function createScheduler(runtime) {
  var jobs = runtime.get('jobs');
  return new jobsClient.Scheduler({
    baseURL: jobs.url,
    timeout: jobs.timeout,
    user: jobs.user,
    password: jobs.password
  });
}



function configure(config) {
  if (typeof config !== 'object') {
    throw new Error('Job.configure: takes exactly one parameter object');
  }
  var user = config.user;
  var password = config.password;
  var status = config.status;
  var startTime = config.start_time;
  var endTime = config.end_time;
  if (!config.hasOwnProperty('user')) {
    throw new Error('Job.configure: user string parameter required');
  }
  if (!config.hasOwnProperty('password')) {
    throw new Error('Job.configure: password string parameter required');
  }
  if (!config.hasOwnProperty('locale')) {
    throw new Error('Job.configure: locale string parameter required');
  }
  if (!config.hasOwnProperty('status')) {
    throw new Error('Job.configure: status boolean parameter required');
  }
  if (!config.hasOwnProperty('start_time')) {
    throw new Error('Job.configure: startTime object parameter required');
  }
  if (!config.hasOwnProperty('end_time')) {
    throw new Error('Job.configure: endTime object parameter required');
  }

  // for now we accept only Date objects until we implement date parsing compatible to XS1
  if (!util.isDate(startTime)) {
    throw new Error('Job.configure: startTime object parameter required');
  }
  if (!util.isDate(endTime)) {
    throw new Error('Job.configure: endTime object parameter required');
  }

  var st = convertTime(startTime, 'startTime');
  var et = convertTime(endTime, 'endTime');

  this._scheduler.sync.updateJob({
    jobId: this._jobId,
    job: {
      user: user,
      password: password,
      active: status
    }
  });

  for (var scheduleKey in this.schedules) {
    if (scheduleKey === '_jobId') {
      continue;
    }
    this._scheduler.sync.updateJobSchedule({
      jobId: this._jobId,
      scheduleId: scheduleKey,
      schedule: {
        startTime: st,
        endTime: et
      }
    });
  }
}

function convertTime(time, propName) {
  if (time === null) {
    return null;
  }
  if (util.isDate(time)) {
    return {
      date: time.toISOString()
    };
  }
  throw new Error('Job.configure: Invalid ' + propName + ' date');
}

function _activate(job, credentials, active) {
  if (typeof credentials !== 'object') {
    throw new Error('Only one parameter object is required');
  }
  if (!credentials.user) {
    throw new Error('User string parameter required');
  }

  if (!credentials.password) {
    throw new Error('Password string parameter required');
  }

  job._scheduler.sync.updateJob({
    jobId: job._jobId,
    job: {
      user: credentials.user,
      password: credentials.password,
      active: active
    }
  });
}

function activate(credentials) {
  _activate(this, credentials, true);
}

function deactivate(credentials) {
  _activate(this, credentials, false);
}
