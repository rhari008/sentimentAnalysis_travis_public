'use strict';

var assert = require('assert');

var Schedule = require('./Schedule');

module.exports = Schedules;

// internal properties are non-enumerable so they are not mixed with schedule ids

function Schedules(scheduler, jobId) {
  assert(scheduler, 'Missing scheduler');
  assert(jobId, 'Missing jobId');

  Object.defineProperty(this, '_scheduler', {
    enumerable: false,
    writable: false,
    value: scheduler
  });
  Object.defineProperty(this, '_jobId', {
    enumerable: false,
    writable: false,
    value: jobId
  });
}

Object.defineProperty(Schedules.prototype, 'delete', {
  enumerable: false,
  value: deleteSchedule
});
Object.defineProperty(Schedules.prototype, 'add', {
  enumerable: false,
  value: addSchedule
});

function deleteSchedule(params) {
  if (params.id) {
    var scheduleId = params.id;
    if (!this.hasOwnProperty(scheduleId)) {
      throw new Error('Schedule ID not found');
    }
    this._scheduler.sync.deleteJobSchedule({
      jobId: this._jobId,
      scheduleId: scheduleId
    });
    delete this[scheduleId];
    return true;
  } else {
    throw new Error('"id" is mandatory');
  }
}

function addSchedule(parameters) {
  var description = parameters.description;
  var xscron = parameters.xscron;
  var parameter = parameters.parameter;

  var body = {};

  if (parameter) {
    if (typeof parameter === 'string') {
      parameter = JSON.parse(parameter);
    } else if (typeof parameter !== 'object') {
      throw new Error('Wrong input type for "parameter"');
    }
    body.data = parameter;
  }
  if (!xscron) {
    throw new Error('"xscron" is mandatory');
  } else if (typeof xscron !== 'string') {
    throw new Error('Wrong input type for "xscron"');
  } else {
    body.cron = xscron;
  }
  if (description) {
    if (typeof description !== 'string') {
      throw new Error('Wrong input type for "description"');
    } else {
      body.description = description;
    }
  }

  var reply = this._scheduler.sync.createJobSchedule({
    jobId: this._jobId,
    schedule: body
  });
  var nscheduleId = reply.scheduleId;
  this[nscheduleId] = new Schedule(this._scheduler, reply.description, reply.data,
    reply.cron, reply.active, this._jobId, nscheduleId);
  return nscheduleId;
}
