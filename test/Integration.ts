import { getAccountKeys } from './keys.helper';

const {
  ACCOUNT_0_PRIVATE_KEY,
  ACCOUNT_0_PUBLIC_KEY,
  ACCOUNT_0_ADDRESS,
  ACCOUNT_1_PRIVATE_KEY,
  ACCOUNT_1_PUBLIC_KEY,
  ACCOUNT_1_ADDRESS,
  ACCOUNT_2_PRIVATE_KEY,
  ACCOUNT_2_PUBLIC_KEY,
  ACCOUNT_2_ADDRESS,
  ACCOUNT_3_PRIVATE_KEY,
  ACCOUNT_3_PUBLIC_KEY,
  ACCOUNT_3_ADDRESS,
} = getAccountKeys();

contract('Integration testing for...', () => {
  // Test communication between contracts, e.g. MultiSpaces <-> Space or Space <-> PaymentManager
  // Test money transfer, e.g. that charging works as expected for Buckets and Spaces, etc
  // Test admin access on different contracts
  // Test
});

export {};
