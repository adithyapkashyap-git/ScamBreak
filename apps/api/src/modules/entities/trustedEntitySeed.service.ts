import { TrustedEntity } from './trustedEntity.model.js';

export type BuiltInEntityDefinition = {
  name: string;
  aliases: string[];
  category: string;
  officialDomains: string[];
  officialSupportChannels: Array<{
    type: 'website' | 'phone' | 'email' | 'app' | 'in_person';
    label: string;
    value: string;
    verified: boolean;
  }>;
  verificationSource: string;
};

export const builtInTrustedEntities: BuiltInEntityDefinition[] = [
  {
    name: 'PayPal',
    aliases: ['paypal', 'paypal inc', 'paypal support', 'paypal security'],
    category: 'bank_payment',
    officialDomains: ['paypal.com', 'paypal-community.com'],
    officialSupportChannels: [
      { type: 'website', label: 'Official Help Center', value: 'https://www.paypal.com/smarthelp/contact-us', verified: true },
      { type: 'website', label: 'Official Resolution Center', value: 'https://www.paypal.com/disputes/', verified: true }
    ],
    verificationSource: 'Official registrant WHOIS and verified portal documentation'
  },
  {
    name: 'Chase Bank',
    aliases: ['chase', 'jpmorgan chase', 'chase bank', 'chase online'],
    category: 'bank_payment',
    officialDomains: ['chase.com', 'jpmorganchase.com'],
    officialSupportChannels: [
      { type: 'website', label: 'Chase Customer Service', value: 'https://www.chase.com/digital/customer-service', verified: true }
    ],
    verificationSource: 'Federal Reserve depository records and official web properties'
  },
  {
    name: 'State Bank of India',
    aliases: ['sbi', 'state bank', 'onlinesbi', 'sbi card'],
    category: 'bank_payment',
    officialDomains: ['sbi.co.in', 'onlinesbi.sbi', 'sbicard.com'],
    officialSupportChannels: [
      { type: 'website', label: 'SBI Customer Care Portal', value: 'https://sbi.co.in/web/customer-care', verified: true }
    ],
    verificationSource: 'Reserve Bank of India regulated entity list'
  },
  {
    name: 'HDFC Bank',
    aliases: ['hdfc', 'hdfc bank', 'hdfc netbanking'],
    category: 'bank_payment',
    officialDomains: ['hdfcbank.com'],
    officialSupportChannels: [
      { type: 'website', label: 'HDFC Bank Customer Support', value: 'https://www.hdfcbank.com/personal/need-help', verified: true }
    ],
    verificationSource: 'Reserve Bank of India regulated entity list'
  },
  {
    name: 'United States Postal Service',
    aliases: ['usps', 'postal service', 'post office', 'usps tracking'],
    category: 'delivery_courier',
    officialDomains: ['usps.com'],
    officialSupportChannels: [
      { type: 'website', label: 'USPS Official Contact Page', value: 'https://www.usps.com/help/contact-us.htm', verified: true }
    ],
    verificationSource: 'United States Federal government official .gov domain registrar'
  },
  {
    name: 'FedEx',
    aliases: ['fedex', 'federal express', 'fedex delivery', 'fedex express'],
    category: 'delivery_courier',
    officialDomains: ['fedex.com'],
    officialSupportChannels: [
      { type: 'website', label: 'FedEx Customer Support', value: 'https://www.fedex.com/en-us/customer-support.html', verified: true }
    ],
    verificationSource: 'Official corporate registrant and verified support directories'
  },
  {
    name: 'DHL',
    aliases: ['dhl', 'dhl express', 'dhl delivery', 'dhl parcel'],
    category: 'delivery_courier',
    officialDomains: ['dhl.com'],
    officialSupportChannels: [
      { type: 'website', label: 'DHL Official Support Portal', value: 'https://www.dhl.com/contact', verified: true }
    ],
    verificationSource: 'Deutsche Post DHL official corporate registry'
  },
  {
    name: 'India Post',
    aliases: ['india post', 'department of posts', 'indiapost'],
    category: 'delivery_courier',
    officialDomains: ['indiapost.gov.in'],
    officialSupportChannels: [
      { type: 'website', label: 'India Post Official Portal', value: 'https://www.indiapost.gov.in', verified: true }
    ],
    verificationSource: 'Government of India official .gov.in domain registry'
  },
  {
    name: 'Amazon',
    aliases: ['amazon', 'amazon.com', 'amazon customer service', 'amazon prime'],
    category: 'marketplace',
    officialDomains: ['amazon.com', 'amazon.in', 'amazon.co.uk', 'amazon.ca', 'amazon.de'],
    officialSupportChannels: [
      { type: 'website', label: 'Amazon Official Customer Service', value: 'https://www.amazon.com/gp/help/customer/display.html', verified: true }
    ],
    verificationSource: 'SEC corporate disclosures and verified corporate domains'
  },
  {
    name: 'Apple',
    aliases: ['apple', 'apple support', 'icloud', 'apple id', 'apple security'],
    category: 'tech_support',
    officialDomains: ['apple.com', 'icloud.com'],
    officialSupportChannels: [
      { type: 'website', label: 'Apple Official Support', value: 'https://support.apple.com', verified: true }
    ],
    verificationSource: 'Official corporate domains and Apple security guidelines'
  },
  {
    name: 'Microsoft',
    aliases: ['microsoft', 'microsoft support', 'windows support', 'microsoft 365', 'outlook', 'live.com'],
    category: 'tech_support',
    officialDomains: ['microsoft.com', 'live.com', 'office.com', 'microsoft365.com'],
    officialSupportChannels: [
      { type: 'website', label: 'Microsoft Official Support', value: 'https://support.microsoft.com', verified: true }
    ],
    verificationSource: 'Microsoft verified enterprise documentation'
  },
  {
    name: 'Google',
    aliases: ['google', 'google account', 'gmail', 'google play', 'google support'],
    category: 'tech_support',
    officialDomains: ['google.com', 'gmail.com', 'googleplay.com'],
    officialSupportChannels: [
      { type: 'website', label: 'Google Account Security Center', value: 'https://myaccount.google.com/security', verified: true }
    ],
    verificationSource: 'Google official enterprise and domain registrar records'
  },
  {
    name: 'Netflix',
    aliases: ['netflix', 'netflix support', 'netflix billing'],
    category: 'streaming',
    officialDomains: ['netflix.com'],
    officialSupportChannels: [
      { type: 'website', label: 'Netflix Help Center', value: 'https://help.netflix.com', verified: true }
    ],
    verificationSource: 'Netflix verified web properties and corporate filings'
  },
  {
    name: 'Internal Revenue Service',
    aliases: ['irs', 'internal revenue service', 'us tax authority', 'irs.gov'],
    category: 'government_authority',
    officialDomains: ['irs.gov'],
    officialSupportChannels: [
      { type: 'website', label: 'IRS Official Telephone Assistance', value: 'https://www.irs.gov/help/telephone-assistance', verified: true }
    ],
    verificationSource: 'Official US Government .gov portal registry'
  },
  {
    name: 'Income Tax Department',
    aliases: ['income tax department', 'income tax india', 'it department', 'incometax.gov.in'],
    category: 'government_authority',
    officialDomains: ['incometax.gov.in'],
    officialSupportChannels: [
      { type: 'website', label: 'Income Tax Official Helpdesk', value: 'https://www.incometax.gov.in/iec/foportal/help', verified: true }
    ],
    verificationSource: 'Government of India Ministry of Finance registry'
  }
];

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Idempotently seeds built-in trusted entities. Never overwrites custom edits. */
export async function seedTrustedEntities(): Promise<void> {
  const now = new Date();
  for (const entity of builtInTrustedEntities) {
    const normalizedName = normalizeName(entity.name);
    await TrustedEntity.updateOne(
      { normalizedName },
      {
        $setOnInsert: {
          name: entity.name,
          normalizedName,
          aliases: entity.aliases.map(normalizeName),
          category: entity.category,
          officialDomains: entity.officialDomains,
          officialSupportChannels: entity.officialSupportChannels,
          verificationStatus: 'verified',
          verificationSource: entity.verificationSource,
          lastVerifiedAt: now
        }
      },
      { upsert: true }
    );
  }
}
