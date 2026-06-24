export type PrintContractConfig = {
  address: `0x${string}`;
  name: string;
  label: string;
  image: string;
};

export const PRINT_CONTRACTS: PrintContractConfig[] = [
  {
    address: '0xfaC9D59B0aF02AbE6E24f7cCBb1531556DE76c57',
    name: 'Feisty Doge Print',
    label: 'Feisty',
    image: '/feisty.webp',
  },
  {
    address: '0x04d4dc290514d0af4ff1ef3034f2183c339a9970',
    name: 'Angry Doge Print',
    label: 'Angry',
    image: '/angry.webp',
  },
];

export const MAX_PER_TX = 10;
