export function getAccountKeys() {
  const ACCOUNT_0_PRIVATE_KEY = process.env.ACCOUNT_0_PRIVATE_KEY ?? '';
  const ACCOUNT_0_PUBLIC_KEY = process.env.ACCOUNT_0_PUBLIC_KEY ?? '';
  const ACCOUNT_0_ADDRESS = process.env.ACCOUNT_0_ADDRESS ?? '';
  const ACCOUNT_1_PRIVATE_KEY = process.env.ACCOUNT_1_PRIVATE_KEY ?? '';
  const ACCOUNT_1_PUBLIC_KEY = process.env.ACCOUNT_1_PUBLIC_KEY ?? '';
  const ACCOUNT_1_ADDRESS = process.env.ACCOUNT_1_ADDRESS ?? '';
  const ACCOUNT_2_PRIVATE_KEY = process.env.ACCOUNT_2_PRIVATE_KEY ?? '';
  const ACCOUNT_2_PUBLIC_KEY = process.env.ACCOUNT_2_PUBLIC_KEY ?? '';
  const ACCOUNT_2_ADDRESS = process.env.ACCOUNT_2_ADDRESS ?? '';
  const ACCOUNT_3_PRIVATE_KEY = process.env.ACCOUNT_3_PRIVATE_KEY ?? '';
  const ACCOUNT_3_PUBLIC_KEY = process.env.ACCOUNT_3_PUBLIC_KEY ?? '';
  const ACCOUNT_3_ADDRESS = process.env.ACCOUNT_3_ADDRESS ?? '';

  if (!ACCOUNT_0_PRIVATE_KEY || !ACCOUNT_0_PUBLIC_KEY || !ACCOUNT_0_ADDRESS) {
    throw new Error('Keys for account 0 not found!');
  }

  if (!ACCOUNT_1_PRIVATE_KEY || !ACCOUNT_1_PUBLIC_KEY || !ACCOUNT_1_ADDRESS) {
    throw new Error('Keys for account 1 not found!');
  }

  if (!ACCOUNT_2_PRIVATE_KEY || !ACCOUNT_2_PUBLIC_KEY || !ACCOUNT_2_ADDRESS) {
    throw new Error('Keys for account 2 not found!');
  }

  if (!ACCOUNT_3_PRIVATE_KEY || !ACCOUNT_3_PUBLIC_KEY || !ACCOUNT_3_ADDRESS) {
    throw new Error('Keys for account 3 not found!');
  }

  return {
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
  };
}
