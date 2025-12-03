import { type Address } from 'viem'

// AssociationsStore contract on Base Sepolia (proxy)
export const ASSOCIATIONS_STORE_ADDRESS: Address = '0x6f4D643BD9332d9Aa3a828576e3a64ccc58D2684'

export const associationsStoreAbi = [
  {
    type: 'function',
    name: 'storeAssociation',
    inputs: [
      {
        name: 'sar',
        type: 'tuple',
        internalType: 'struct AssociatedAccounts.SignedAssociationRecord',
        components: [
          { name: 'revokedAt', type: 'uint40', internalType: 'uint40' },
          { name: 'initiatorKeyType', type: 'bytes2', internalType: 'bytes2' },
          { name: 'approverKeyType', type: 'bytes2', internalType: 'bytes2' },
          { name: 'initiatorSignature', type: 'bytes', internalType: 'bytes' },
          { name: 'approverSignature', type: 'bytes', internalType: 'bytes' },
          {
            name: 'record',
            type: 'tuple',
            internalType: 'struct AssociatedAccounts.AssociatedAccountRecord',
            components: [
              { name: 'initiator', type: 'bytes', internalType: 'bytes' },
              { name: 'approver', type: 'bytes', internalType: 'bytes' },
              { name: 'validAt', type: 'uint40', internalType: 'uint40' },
              { name: 'validUntil', type: 'uint40', internalType: 'uint40' },
              { name: 'interfaceId', type: 'bytes4', internalType: 'bytes4' },
              { name: 'data', type: 'bytes', internalType: 'bytes' },
            ],
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revokeAssociation',
    inputs: [
      { name: 'associationId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'revokedAt', type: 'uint40', internalType: 'uint40' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getAssociation',
    inputs: [{ name: 'associationId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct AssociatedAccounts.SignedAssociationRecord',
        components: [
          { name: 'revokedAt', type: 'uint40', internalType: 'uint40' },
          { name: 'initiatorKeyType', type: 'bytes2', internalType: 'bytes2' },
          { name: 'approverKeyType', type: 'bytes2', internalType: 'bytes2' },
          { name: 'initiatorSignature', type: 'bytes', internalType: 'bytes' },
          { name: 'approverSignature', type: 'bytes', internalType: 'bytes' },
          {
            name: 'record',
            type: 'tuple',
            internalType: 'struct AssociatedAccounts.AssociatedAccountRecord',
            components: [
              { name: 'initiator', type: 'bytes', internalType: 'bytes' },
              { name: 'approver', type: 'bytes', internalType: 'bytes' },
              { name: 'validAt', type: 'uint40', internalType: 'uint40' },
              { name: 'validUntil', type: 'uint40', internalType: 'uint40' },
              { name: 'interfaceId', type: 'bytes4', internalType: 'bytes4' },
              { name: 'data', type: 'bytes', internalType: 'bytes' },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'areAccountsAssociated',
    inputs: [
      { name: 'account1', type: 'bytes', internalType: 'bytes' },
      { name: 'account2', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAssociationsForAccount',
    inputs: [{ name: 'account', type: 'bytes', internalType: 'bytes' }],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        internalType: 'struct AssociatedAccounts.SignedAssociationRecord[]',
        components: [
          { name: 'revokedAt', type: 'uint40', internalType: 'uint40' },
          { name: 'initiatorKeyType', type: 'bytes2', internalType: 'bytes2' },
          { name: 'approverKeyType', type: 'bytes2', internalType: 'bytes2' },
          { name: 'initiatorSignature', type: 'bytes', internalType: 'bytes' },
          { name: 'approverSignature', type: 'bytes', internalType: 'bytes' },
          {
            name: 'record',
            type: 'tuple',
            internalType: 'struct AssociatedAccounts.AssociatedAccountRecord',
            components: [
              { name: 'initiator', type: 'bytes', internalType: 'bytes' },
              { name: 'approver', type: 'bytes', internalType: 'bytes' },
              { name: 'validAt', type: 'uint40', internalType: 'uint40' },
              { name: 'validUntil', type: 'uint40', internalType: 'uint40' },
              { name: 'interfaceId', type: 'bytes4', internalType: 'bytes4' },
              { name: 'data', type: 'bytes', internalType: 'bytes' },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'AssociationCreated',
    inputs: [
      { name: 'hash', type: 'bytes32', indexed: true, internalType: 'bytes32' },
      { name: 'initiator', type: 'bytes32', indexed: true, internalType: 'bytes32' },
      { name: 'approver', type: 'bytes32', indexed: true, internalType: 'bytes32' },
      {
        name: 'sar',
        type: 'tuple',
        indexed: false,
        internalType: 'struct AssociatedAccounts.SignedAssociationRecord',
        components: [
          { name: 'revokedAt', type: 'uint40', internalType: 'uint40' },
          { name: 'initiatorKeyType', type: 'bytes2', internalType: 'bytes2' },
          { name: 'approverKeyType', type: 'bytes2', internalType: 'bytes2' },
          { name: 'initiatorSignature', type: 'bytes', internalType: 'bytes' },
          { name: 'approverSignature', type: 'bytes', internalType: 'bytes' },
          {
            name: 'record',
            type: 'tuple',
            internalType: 'struct AssociatedAccounts.AssociatedAccountRecord',
            components: [
              { name: 'initiator', type: 'bytes', internalType: 'bytes' },
              { name: 'approver', type: 'bytes', internalType: 'bytes' },
              { name: 'validAt', type: 'uint40', internalType: 'uint40' },
              { name: 'validUntil', type: 'uint40', internalType: 'uint40' },
              { name: 'interfaceId', type: 'bytes4', internalType: 'bytes4' },
              { name: 'data', type: 'bytes', internalType: 'bytes' },
            ],
          },
        ],
      },
    ],
    anonymous: false,
  },
  { type: 'error', name: 'AssociationAlreadyExists', inputs: [] },
  { type: 'error', name: 'AssociationAlreadyRevoked', inputs: [] },
  { type: 'error', name: 'AssociationNotFound', inputs: [] },
  { type: 'error', name: 'InvalidAssociation', inputs: [] },
  { type: 'error', name: 'UnauthorizedRevocation', inputs: [] },
  {
    type: 'error',
    name: 'InteroperableAddressParsingError',
    inputs: [{ name: '', type: 'bytes', internalType: 'bytes' }],
  },
  {
    type: 'error',
    name: 'UnsupportedChainType',
    inputs: [{ name: 'chainType', type: 'bytes2', internalType: 'bytes2' }],
  },
  {
    type: 'error',
    name: 'UnsupportedKeyType',
    inputs: [{ name: 'keyType', type: 'bytes2', internalType: 'bytes2' }],
  },
] as const

