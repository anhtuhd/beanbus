import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  getRequestWorkflow,
  REQUEST_WORKFLOW_STEPS,
} from '../app/admin/requests/request-workflow.ts';

test('booking requests expose a linear admin workflow', () => {
  assert.deepEqual(REQUEST_WORKFLOW_STEPS.booking, ['pending', 'confirmed', 'completed']);
  assert.deepEqual(getRequestWorkflow('booking', 'pending'), {
    currentStepIndex: 0,
    nextStatus: 'confirmed',
    secondaryStatuses: ['rejected', 'cancelled'],
    terminal: false,
  });
  assert.deepEqual(getRequestWorkflow('booking', 'confirmed'), {
    currentStepIndex: 1,
    nextStatus: 'completed',
    secondaryStatuses: ['cancelled'],
    terminal: false,
  });
  assert.equal(getRequestWorkflow('booking', 'completed').terminal, true);
  assert.equal(getRequestWorkflow('booking', 'rejected').terminal, true);
  assert.equal(getRequestWorkflow('booking', 'cancelled').terminal, true);
});

test('customer requests expose a linear support workflow', () => {
  assert.deepEqual(REQUEST_WORKFLOW_STEPS.customer, ['pending', 'in_progress', 'resolved']);
  assert.deepEqual(getRequestWorkflow('customer', 'pending'), {
    currentStepIndex: 0,
    nextStatus: 'in_progress',
    secondaryStatuses: ['rejected'],
    terminal: false,
  });
  assert.deepEqual(getRequestWorkflow('customer', 'in_progress'), {
    currentStepIndex: 1,
    nextStatus: 'resolved',
    secondaryStatuses: ['rejected'],
    terminal: false,
  });
  assert.equal(getRequestWorkflow('customer', 'resolved').terminal, true);
  assert.equal(getRequestWorkflow('customer', 'rejected').terminal, true);
  assert.equal(getRequestWorkflow('customer', 'cancelled').terminal, true);
});

test('request status controls use one-click workflow actions instead of a status select', () => {
  const source = readFileSync(new URL('../app/admin/requests/RequestStatusForm.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /<select/);
  assert.match(source, /aria-current=\{stepState === 'current' \? 'step'/);
  assert.match(source, /name="status" value=\{workflow\.nextStatus\}/);
  assert.match(source, /name="status" value=\{status\}/);
  assert.match(source, /window\.confirm/);
});
