// Dummy identities. Sites normally injects these headers after real sign-in; locally we send them directly.
// They exist only for dummy-mode testing. Real access means real accounts approved through the Access tab.
export const USERS = {
  owner:   { id: 'dummy-owner',   email: 'owner@dummy.invalid' },
  buyer:   { id: 'dummy-buyer',   email: 'buyer@dummy.invalid' },
  seller:  { id: 'dummy-seller',  email: 'seller@dummy.invalid' },
  legal:   { id: 'dummy-legal',   email: 'legal@dummy.invalid' },
  bank:    { id: 'dummy-bank',    email: 'bank@dummy.invalid' },
  captain: { id: 'dummy-captain', email: 'captain@dummy.invalid' },
  outsider:{ id: 'dummy-outsider',email: 'outsider@dummy.invalid' },
};

export const headersFor = user => ({ 'oai-authenticated-user-id': user.id, 'oai-authenticated-user-email': user.email });
