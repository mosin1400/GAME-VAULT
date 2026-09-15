export type StorageOperationKind = 'checkpoint' | 'publish';
export type StorageOperationState = 'pending' | 'running' | 'bytes_ready' | 'succeeded' | 'failed' | 'cancelled';

export interface BeginOperation {
  actorId: string;
  kind: StorageOperationKind;
  idempotencyKey: string;
  requestHash: string;
}

export interface OperationReceipt extends BeginOperation {
  id: string;
  state: StorageOperationState;
}

export class StorageOperationError extends Error {
  constructor(readonly code: 'IDEMPOTENCY_KEY_REUSED' | 'INVALID_OPERATION_TRANSITION' | 'OPERATION_NOT_FOUND') {
    super(code);
  }
}

function keyFor(request: BeginOperation): string {
  return `${request.actorId}\u0000${request.kind}\u0000${request.idempotencyKey}`;
}

function allowsTransition(from: StorageOperationState, to: StorageOperationState): boolean {
  return (
    (from === 'pending' && (to === 'running' || to === 'cancelled'))
    || (from === 'running' && (to === 'bytes_ready' || to === 'failed' || to === 'cancelled'))
    || (from === 'bytes_ready' && (to === 'succeeded' || to === 'failed' || to === 'cancelled'))
  );
}

function receipt(operation: OperationReceipt): OperationReceipt {
  return { ...operation };
}

/**
 * Test/local adapter for the durable operation-journal port. Production wiring
 * must replace it with a database repository protected by a unique constraint.
 */
export class MemoryOperationJournal {
  private readonly byId = new Map<string, OperationReceipt>();
  private readonly byIdempotencyKey = new Map<string, string>();

  constructor(private readonly createId: () => string) {}

  begin(request: BeginOperation): OperationReceipt {
    const requestKey = keyFor(request);
    const previousId = this.byIdempotencyKey.get(requestKey);
    if (previousId) {
      const previous = this.byId.get(previousId);
      if (!previous) throw new StorageOperationError('OPERATION_NOT_FOUND');
      if (previous.requestHash !== request.requestHash) throw new StorageOperationError('IDEMPOTENCY_KEY_REUSED');
      return receipt(previous);
    }

    const operation: OperationReceipt = { id: this.createId(), ...request, state: 'pending' };
    this.byId.set(operation.id, operation);
    this.byIdempotencyKey.set(requestKey, operation.id);
    return receipt(operation);
  }

  transition(id: string, state: StorageOperationState): OperationReceipt {
    const current = this.byId.get(id);
    if (!current) throw new StorageOperationError('OPERATION_NOT_FOUND');
    if (!allowsTransition(current.state, state)) throw new StorageOperationError('INVALID_OPERATION_TRANSITION');
    current.state = state;
    return receipt(current);
  }

  list(): OperationReceipt[] {
    return [...this.byId.values()].map(receipt);
  }
}
