// Shared LeadFlow lists. Colors live in leadflow.css as --lf-* tokens.

export const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida',
  'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine',
  'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska',
  'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas',
  'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
];

// War Room's queue builder filters leads by an exact industry match, so a
// lead added through the Add Lead form needs its industry picked from this
// same list (or typed to match it) to actually be eligible for a queue.
export const NICHES = ['restaurant', 'salon', 'barbershop', 'gym', 'plumber', 'electrician', 'HVAC contractor', 'solar', 'real estate'];
