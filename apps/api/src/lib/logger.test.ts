import { describe, expect, it } from 'vitest';

import { safeErrorMetadata } from './logger.js';

describe('safe error metadata', () => {
  it('keeps a diagnostic category without serializing an arbitrary error message', () => {
    const error = Object.assign(new Error('raw submitted evidence must not be logged'), { code: 'UPSTREAM_FAILURE' });

    expect(safeErrorMetadata(error)).toEqual({ errorType: 'Error', errorCode: 'UPSTREAM_FAILURE' });
    expect(safeErrorMetadata(error)).not.toHaveProperty('message');
  });

  it('drops nonconforming error codes', () => {
    expect(safeErrorMetadata({ name: 'ProviderError', code: 'contains sensitive value' })).toEqual({ errorType: 'ProviderError' });
  });
});
