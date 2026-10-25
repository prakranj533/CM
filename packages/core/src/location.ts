/**
 * India detection for posting locations.
 *
 * Location text comes straight from the source board, so the same posting may
 * say "India", "Bengaluru, India", a bare city name, or a multi-country list.
 * Word boundaries matter: "Indiana" must not match "india".
 */

// Cities omitted when the name collides with a well-known non-Indian place
// (Salem, Kota) or a common word.
const INDIA_CITY_PATTERN = /\b(bengaluru|bangalore|mumbai|bombay|delhi|new delhi|ncr|hyderabad|secunderabad|chennai|madras|pune|kolkata|calcutta|gurugram|gurgaon|noida|greater noida|ahmedabad|kochi|cochin|jaipur|coimbatore|thiruvananthapuram|trivandrum|indore|lucknow|chandigarh|mohali|bhubaneswar|nagpur|visakhapatnam|vizag|mysuru|mysore|bhopal|patna|surat|vadodara|baroda|ludhiana|nashik|madurai|varanasi|ranchi|raipur|dehradun|goa|gandhinagar|jamshedpur|kanpur|agra|thrissur|mangaluru|mangalore|belagavi|hubballi|hubli|tiruchirappalli|trichy|warangal|vijayawada|guntur|rajkot|prayagraj|allahabad|jabalpur|gwalior|amritsar|jalandhar|faridabad|meerut|ghaziabad|howrah|dhanbad|guwahati|puducherry|pondicherry|vellore|erode|tirupati|nellore|kakinada|kurnool|haridwar|roorkee|sonipat|panipat|rohtak|jammu|srinagar|jodhpur|udaipur|bikaner|ajmer|aligarh|moradabad|bareilly|gorakhpur|jhansi|bhilai|durg|korba|jamshedpur|siliguri|asansol|durgapur|imphal|shillong|aizawl|agartala|kohima|dimapur|gangtok|itanagar|panaji|margao|madgaon|bhavnagar|jamnagar|gandhidham|anand|nadiad|junagadh|kolhapur|sangli|solapur|akola|amravati|malegaon|jalgaon|latur|nanded|parbhani|satara|ratnagiri|karimnagar|nizamabad|khammam|tirunelveli|thoothukudi|tuticorin|hosur|krishnagiri|sambalpur|rourkela|cuttack|sambalpur|haldia|kharagpur|jamshedpur)\b/i;

const INDIA_PATTERN = /\bindia\b/i;

export function isIndiaLocation(location: string | null | undefined): boolean {
  if (!location) return false;
  return INDIA_PATTERN.test(location) || INDIA_CITY_PATTERN.test(location);
}
