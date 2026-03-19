// src/services/tennisApi.js
import { supabase } from './supabase';

const MATCH_SELECT = `
  id, status, tournament, round, surface, score, match_date, local_date, match_type, winner_id,
  player1:players!player1_id (
    id, name, country, flag, rank, wins, losses,
    ace_avg, surface_pref, first_serve_pct, recent_form
  ),
  player2:players!player2_id (
    id, name, country, flag, rank, wins, losses,
    ace_avg, surface_pref, first_serve_pct, recent_form
  )
`;

// ── Complete world flag map ───────────────────────────────────────────────────
// Covers full country names, 3-letter ISO (ATP/WTA style), 2-letter ISO
export const FLAG_MAP = {
  // ── Full names ──
  'Afghanistan': '🇦🇫', 'Albania': '🇦🇱', 'Algeria': '🇩🇿', 'Andorra': '🇦🇩',
  'Angola': '🇦🇴', 'Antigua and Barbuda': '🇦🇬', 'Argentina': '🇦🇷', 'Armenia': '🇦🇲',
  'Australia': '🇦🇺', 'Austria': '🇦🇹', 'Azerbaijan': '🇦🇿', 'Bahamas': '🇧🇸',
  'Bahrain': '🇧🇭', 'Bangladesh': '🇧🇩', 'Barbados': '🇧🇧', 'Belarus': '🇧🇾',
  'Belgium': '🇧🇪', 'Belize': '🇧🇿', 'Benin': '🇧🇯', 'Bhutan': '🇧🇹',
  'Bolivia': '🇧🇴', 'Bosnia and Herzegovina': '🇧🇦', 'Bosnia': '🇧🇦', 'Botswana': '🇧🇼',
  'Brazil': '🇧🇷', 'Brunei': '🇧🇳', 'Bulgaria': '🇧🇬', 'Burkina Faso': '🇧🇫',
  'Burundi': '🇧🇮', 'Cambodia': '🇰🇭', 'Cameroon': '🇨🇲', 'Canada': '🇨🇦',
  'Cape Verde': '🇨🇻', 'Central African Republic': '🇨🇫', 'Chad': '🇹🇩', 'Chile': '🇨🇱',
  'China': '🇨🇳', 'Colombia': '🇨🇴', 'Comoros': '🇰🇲', 'Congo': '🇨🇬',
  'Costa Rica': '🇨🇷', 'Croatia': '🇭🇷', 'Cuba': '🇨🇺', 'Cyprus': '🇨🇾',
  'Czech Republic': '🇨🇿', 'Czechia': '🇨🇿', 'Denmark': '🇩🇰', 'Djibouti': '🇩🇯',
  'Dominican Republic': '🇩🇴', 'Ecuador': '🇪🇨', 'Egypt': '🇪🇬', 'El Salvador': '🇸🇻',
  'Equatorial Guinea': '🇬🇶', 'Eritrea': '🇪🇷', 'Estonia': '🇪🇪', 'Eswatini': '🇸🇿',
  'Ethiopia': '🇪🇹', 'Fiji': '🇫🇯', 'Finland': '🇫🇮', 'France': '🇫🇷',
  'Gabon': '🇬🇦', 'Gambia': '🇬🇲', 'Georgia': '🇬🇪', 'Germany': '🇩🇪',
  'Ghana': '🇬🇭', 'Greece': '🇬🇷', 'Grenada': '🇬🇩', 'Guatemala': '🇬🇹',
  'Guinea': '🇬🇳', 'Guinea-Bissau': '🇬🇼', 'Guyana': '🇬🇾', 'Haiti': '🇭🇹',
  'Honduras': '🇭🇳', 'Hungary': '🇭🇺', 'Iceland': '🇮🇸', 'India': '🇮🇳',
  'Indonesia': '🇮🇩', 'Iran': '🇮🇷', 'Iraq': '🇮🇶', 'Ireland': '🇮🇪',
  'Israel': '🇮🇱', 'Italy': '🇮🇹', 'Ivory Coast': '🇨🇮', 'Jamaica': '🇯🇲',
  'Japan': '🇯🇵', 'Jordan': '🇯🇴', 'Kazakhstan': '🇰🇿', 'Kenya': '🇰🇪',
  'Kosovo': '🇽🇰', 'Kuwait': '🇰🇼', 'Kyrgyzstan': '🇰🇬', 'Laos': '🇱🇦',
  'Latvia': '🇱🇻', 'Lebanon': '🇱🇧', 'Lesotho': '🇱🇸', 'Liberia': '🇱🇷',
  'Libya': '🇱🇾', 'Liechtenstein': '🇱🇮', 'Lithuania': '🇱🇹', 'Luxembourg': '🇱🇺',
  'Madagascar': '🇲🇬', 'Malawi': '🇲🇼', 'Malaysia': '🇲🇾', 'Maldives': '🇲🇻',
  'Mali': '🇲🇱', 'Malta': '🇲🇹', 'Mauritania': '🇲🇷', 'Mauritius': '🇲🇺',
  'Mexico': '🇲🇽', 'Moldova': '🇲🇩', 'Monaco': '🇲🇨', 'Mongolia': '🇲🇳',
  'Montenegro': '🇲🇪', 'Morocco': '🇲🇦', 'Mozambique': '🇲🇿', 'Myanmar': '🇲🇲',
  'Namibia': '🇳🇦', 'Nepal': '🇳🇵', 'Netherlands': '🇳🇱', 'New Zealand': '🇳🇿',
  'Nicaragua': '🇳🇮', 'Niger': '🇳🇪', 'Nigeria': '🇳🇬', 'North Korea': '🇰🇵',
  'North Macedonia': '🇲🇰', 'Norway': '🇳🇴', 'Oman': '🇴🇲', 'Pakistan': '🇵🇰',
  'Palestine': '🇵🇸', 'Panama': '🇵🇦', 'Papua New Guinea': '🇵🇬', 'Paraguay': '🇵🇾',
  'Peru': '🇵🇪', 'Philippines': '🇵🇭', 'Poland': '🇵🇱', 'Portugal': '🇵🇹',
  'Puerto Rico': '🇵🇷', 'Qatar': '🇶🇦', 'Romania': '🇷🇴', 'Russia': '🇷🇺',
  'Rwanda': '🇷🇼', 'Saudi Arabia': '🇸🇦', 'Senegal': '🇸🇳', 'Serbia': '🇷🇸',
  'Sierra Leone': '🇸🇱', 'Singapore': '🇸🇬', 'Slovakia': '🇸🇰', 'Slovenia': '🇸🇮',
  'Somalia': '🇸🇴', 'South Africa': '🇿🇦', 'South Korea': '🇰🇷', 'Korea': '🇰🇷',
  'South Sudan': '🇸🇸', 'Spain': '🇪🇸', 'Sri Lanka': '🇱🇰', 'Sudan': '🇸🇩',
  'Suriname': '🇸🇷', 'Sweden': '🇸🇪', 'Switzerland': '🇨🇭', 'Syria': '🇸🇾',
  'Taiwan': '🇹🇼', 'Tajikistan': '🇹🇯', 'Tanzania': '🇹🇿', 'Thailand': '🇹🇭',
  'Timor-Leste': '🇹🇱', 'Togo': '🇹🇬', 'Trinidad and Tobago': '🇹🇹',
  'Tunisia': '🇹🇳', 'Turkey': '🇹🇷', 'Turkmenistan': '🇹🇲', 'Uganda': '🇺🇬',
  'Ukraine': '🇺🇦', 'United Arab Emirates': '🇦🇪', 'UAE': '🇦🇪',
  'United Kingdom': '🇬🇧', 'Great Britain': '🇬🇧', 'England': '🇬🇧',
  'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'United States': '🇺🇸', 'USA': '🇺🇸', 'United States of America': '🇺🇸',
  'Uruguay': '🇺🇾', 'Uzbekistan': '🇺🇿', 'Venezuela': '🇻🇪', 'Vietnam': '🇻🇳',
  'Yemen': '🇾🇪', 'Zambia': '🇿🇲', 'Zimbabwe': '🇿🇼',

  // ── 3-letter ISO (ATP/WTA API format) ──
  'AFG': '🇦🇫', 'ALB': '🇦🇱', 'ALG': '🇩🇿', 'DZA': '🇩🇿', 'AND': '🇦🇩',
  'ANG': '🇦🇴', 'AGO': '🇦🇴', 'ARG': '🇦🇷', 'ARM': '🇦🇲', 'AUS': '🇦🇺',
  'AUT': '🇦🇹', 'AZE': '🇦🇿', 'BAH': '🇧🇸', 'BHS': '🇧🇸', 'BRN': '🇧🇭',
  'BAN': '🇧🇩', 'BGD': '🇧🇩', 'BRB': '🇧🇧', 'BLR': '🇧🇾', 'BEL': '🇧🇪',
  'BLZ': '🇧🇿', 'BEN': '🇧🇯', 'BTN': '🇧🇹', 'BOL': '🇧🇴', 'BIH': '🇧🇦',
  'BOT': '🇧🇼', 'BWA': '🇧🇼', 'BRA': '🇧🇷', 'BRU': '🇧🇳', 'BUL': '🇧🇬',
  'BGR': '🇧🇬', 'BFA': '🇧🇫', 'BDI': '🇧🇮', 'KHM': '🇰🇭', 'CMR': '🇨🇲',
  'CAN': '🇨🇦', 'CPV': '🇨🇻', 'CAF': '🇨🇫', 'TCD': '🇹🇩', 'CHI': '🇨🇱',
  'CHL': '🇨🇱', 'CHN': '🇨🇳', 'COL': '🇨🇴', 'COM': '🇰🇲', 'CGO': '🇨🇬',
  'COG': '🇨🇬', 'CRC': '🇨🇷', 'CRO': '🇭🇷', 'HRV': '🇭🇷', 'CUB': '🇨🇺',
  'CYP': '🇨🇾', 'CZE': '🇨🇿', 'DEN': '🇩🇰', 'DNK': '🇩🇰', 'DJI': '🇩🇯',
  'DOM': '🇩🇴', 'ECU': '🇪🇨', 'EGY': '🇪🇬', 'SLV': '🇸🇻', 'GNQ': '🇬🇶',
  'ERI': '🇪🇷', 'EST': '🇪🇪', 'SWZ': '🇸🇿', 'ETH': '🇪🇹', 'FIJ': '🇫🇯',
  'FJI': '🇫🇯', 'FIN': '🇫🇮', 'FRA': '🇫🇷', 'GAB': '🇬🇦', 'GMB': '🇬🇲',
  'GEO': '🇬🇪', 'GER': '🇩🇪', 'DEU': '🇩🇪', 'GHA': '🇬🇭', 'GRE': '🇬🇷',
  'GRC': '🇬🇷', 'GRD': '🇬🇩', 'GTM': '🇬🇹', 'GUI': '🇬🇳', 'GNB': '🇬🇼',
  'GUY': '🇬🇾', 'HAI': '🇭🇹', 'HTI': '🇭🇹', 'HON': '🇭🇳', 'HND': '🇭🇳',
  'HUN': '🇭🇺', 'ISL': '🇮🇸', 'IND': '🇮🇳', 'INA': '🇮🇩', 'IDN': '🇮🇩',
  'IRI': '🇮🇷', 'IRN': '🇮🇷', 'IRQ': '🇮🇶', 'IRL': '🇮🇪', 'ISR': '🇮🇱',
  'ITA': '🇮🇹', 'CIV': '🇨🇮', 'JAM': '🇯🇲', 'JPN': '🇯🇵', 'JOR': '🇯🇴',
  'KAZ': '🇰🇿', 'KEN': '🇰🇪', 'KOS': '🇽🇰', 'XKX': '🇽🇰', 'KUW': '🇰🇼',
  'KWT': '🇰🇼', 'KGZ': '🇰🇬', 'LAO': '🇱🇦', 'LAT': '🇱🇻', 'LVA': '🇱🇻',
  'LIB': '🇱🇧', 'LBN': '🇱🇧', 'LES': '🇱🇸', 'LSO': '🇱🇸', 'LBR': '🇱🇷',
  'LBA': '🇱🇾', 'LBY': '🇱🇾', 'LIE': '🇱🇮', 'LTU': '🇱🇹', 'LUX': '🇱🇺',
  'MAD': '🇲🇬', 'MDG': '🇲🇬', 'MAW': '🇲🇼', 'MWI': '🇲🇼', 'MAS': '🇲🇾',
  'MYS': '🇲🇾', 'MDV': '🇲🇻', 'MLI': '🇲🇱', 'MLT': '🇲🇹', 'MTN': '🇲🇷',
  'MRT': '🇲🇷', 'MRI': '🇲🇺', 'MUS': '🇲🇺', 'MEX': '🇲🇽', 'MDA': '🇲🇩',
  'MCO': '🇲🇨', 'MGL': '🇲🇳', 'MNG': '🇲🇳', 'MNE': '🇲🇪', 'MAR': '🇲🇦',
  'MOZ': '🇲🇿', 'MYA': '🇲🇲', 'MMR': '🇲🇲', 'NAM': '🇳🇦', 'NEP': '🇳🇵',
  'NED': '🇳🇱', 'NLD': '🇳🇱', 'NZL': '🇳🇿', 'NCA': '🇳🇮', 'NIC': '🇳🇮',
  'NGR': '🇳🇬', 'NGA': '🇳🇬', 'PRK': '🇰🇵', 'MKD': '🇲🇰', 'NOR': '🇳🇴',
  'OMA': '🇴🇲', 'OMN': '🇴🇲', 'PAK': '🇵🇰', 'PLE': '🇵🇸', 'PSE': '🇵🇸',
  'PAN': '🇵🇦', 'PNG': '🇵🇬', 'PAR': '🇵🇾', 'PRY': '🇵🇾', 'PER': '🇵🇪',
  'PHI': '🇵🇭', 'PHL': '🇵🇭', 'POL': '🇵🇱', 'POR': '🇵🇹', 'PRT': '🇵🇹',
  'PUR': '🇵🇷', 'QAT': '🇶🇦', 'ROU': '🇷🇴', 'RUS': '🇷🇺', 'RWA': '🇷🇼',
  'KSA': '🇸🇦', 'SAU': '🇸🇦', 'SEN': '🇸🇳', 'SRB': '🇷🇸', 'SLE': '🇸🇱',
  'SGP': '🇸🇬', 'SVK': '🇸🇰', 'SVN': '🇸🇮', 'SOM': '🇸🇴', 'RSA': '🇿🇦',
  'ZAF': '🇿🇦', 'KOR': '🇰🇷', 'SSD': '🇸🇸', 'ESP': '🇪🇸', 'SRI': '🇱🇰',
  'LKA': '🇱🇰', 'SUD': '🇸🇩', 'SDN': '🇸🇩', 'SUR': '🇸🇷', 'SWE': '🇸🇪',
  'SUI': '🇨🇭', 'CHE': '🇨🇭', 'SYR': '🇸🇾', 'TWN': '🇹🇼', 'TPE': '🇹🇼',
  'TJK': '🇹🇯', 'TAN': '🇹🇿', 'TZA': '🇹🇿', 'THA': '🇹🇭', 'TLS': '🇹🇱',
  'TOG': '🇹🇬', 'TTO': '🇹🇹', 'TUN': '🇹🇳', 'TUR': '🇹🇷', 'TKM': '🇹🇲',
  'UGA': '🇺🇬', 'UKR': '🇺🇦', 'UAE': '🇦🇪', 'GBR': '🇬🇧', 'USA': '🇺🇸',
  'URU': '🇺🇾', 'URY': '🇺🇾', 'UZB': '🇺🇿', 'VEN': '🇻🇪', 'VIE': '🇻🇳',
  'VNM': '🇻🇳', 'YEM': '🇾🇪', 'ZAM': '🇿🇲', 'ZMB': '🇿🇲', 'ZIM': '🇿🇼',
  'ZWE': '🇿🇼',

  // ── 2-letter ISO ──
  'AF': '🇦🇫', 'AL': '🇦🇱', 'DZ': '🇩🇿', 'AD': '🇦🇩', 'AO': '🇦🇴',
  'AG': '🇦🇬', 'AR': '🇦🇷', 'AM': '🇦🇲', 'AU': '🇦🇺', 'AT': '🇦🇹',
  'AZ': '🇦🇿', 'BS': '🇧🇸', 'BH': '🇧🇭', 'BD': '🇧🇩', 'BB': '🇧🇧',
  'BY': '🇧🇾', 'BE': '🇧🇪', 'BZ': '🇧🇿', 'BJ': '🇧🇯', 'BT': '🇧🇹',
  'BO': '🇧🇴', 'BA': '🇧🇦', 'BW': '🇧🇼', 'BR': '🇧🇷', 'BN': '🇧🇳',
  'BG': '🇧🇬', 'BF': '🇧🇫', 'BI': '🇧🇮', 'KH': '🇰🇭', 'CM': '🇨🇲',
  'CA': '🇨🇦', 'CV': '🇨🇻', 'CF': '🇨🇫', 'TD': '🇹🇩', 'CL': '🇨🇱',
  'CN': '🇨🇳', 'CO': '🇨🇴', 'KM': '🇰🇲', 'CG': '🇨🇬', 'CR': '🇨🇷',
  'HR': '🇭🇷', 'CU': '🇨🇺', 'CY': '🇨🇾', 'CZ': '🇨🇿', 'DK': '🇩🇰',
  'DJ': '🇩🇯', 'DO': '🇩🇴', 'EC': '🇪🇨', 'EG': '🇪🇬', 'SV': '🇸🇻',
  'GQ': '🇬🇶', 'ER': '🇪🇷', 'EE': '🇪🇪', 'SZ': '🇸🇿', 'ET': '🇪🇹',
  'FJ': '🇫🇯', 'FI': '🇫🇮', 'FR': '🇫🇷', 'GA': '🇬🇦', 'GM': '🇬🇲',
  'GE': '🇬🇪', 'DE': '🇩🇪', 'GH': '🇬🇭', 'GR': '🇬🇷', 'GD': '🇬🇩',
  'GT': '🇬🇹', 'GN': '🇬🇳', 'GW': '🇬🇼', 'GY': '🇬🇾', 'HT': '🇭🇹',
  'HN': '🇭🇳', 'HU': '🇭🇺', 'IS': '🇮🇸', 'IN': '🇮🇳', 'ID': '🇮🇩',
  'IR': '🇮🇷', 'IQ': '🇮🇶', 'IE': '🇮🇪', 'IL': '🇮🇱', 'IT': '🇮🇹',
  'CI': '🇨🇮', 'JM': '🇯🇲', 'JP': '🇯🇵', 'JO': '🇯🇴', 'KZ': '🇰🇿',
  'KE': '🇰🇪', 'XK': '🇽🇰', 'KW': '🇰🇼', 'KG': '🇰🇬', 'LA': '🇱🇦',
  'LV': '🇱🇻', 'LB': '🇱🇧', 'LS': '🇱🇸', 'LR': '🇱🇷', 'LY': '🇱🇾',
  'LI': '🇱🇮', 'LT': '🇱🇹', 'LU': '🇱🇺', 'MG': '🇲🇬', 'MW': '🇲🇼',
  'MY': '🇲🇾', 'MV': '🇲🇻', 'ML': '🇲🇱', 'MT': '🇲🇹', 'MR': '🇲🇷',
  'MU': '🇲🇺', 'MX': '🇲🇽', 'MD': '🇲🇩', 'MC': '🇲🇨', 'MN': '🇲🇳',
  'ME': '🇲🇪', 'MA': '🇲🇦', 'MZ': '🇲🇿', 'MM': '🇲🇲', 'NA': '🇳🇦',
  'NP': '🇳🇵', 'NL': '🇳🇱', 'NZ': '🇳🇿', 'NI': '🇳🇮', 'NE': '🇳🇪',
  'NG': '🇳🇬', 'KP': '🇰🇵', 'MK': '🇲🇰', 'NO': '🇳🇴', 'OM': '🇴🇲',
  'PK': '🇵🇰', 'PS': '🇵🇸', 'PA': '🇵🇦', 'PG': '🇵🇬', 'PY': '🇵🇾',
  'PE': '🇵🇪', 'PH': '🇵🇭', 'PL': '🇵🇱', 'PT': '🇵🇹', 'PR': '🇵🇷',
  'QA': '🇶🇦', 'RO': '🇷🇴', 'RU': '🇷🇺', 'RW': '🇷🇼', 'SA': '🇸🇦',
  'SN': '🇸🇳', 'RS': '🇷🇸', 'SL': '🇸🇱', 'SG': '🇸🇬', 'SK': '🇸🇰',
  'SI': '🇸🇮', 'SO': '🇸🇴', 'ZA': '🇿🇦', 'KR': '🇰🇷', 'SS': '🇸🇸',
  'ES': '🇪🇸', 'LK': '🇱🇰', 'SD': '🇸🇩', 'SR': '🇸🇷', 'SE': '🇸🇪',
  'CH': '🇨🇭', 'SY': '🇸🇾', 'TW': '🇹🇼', 'TJ': '🇹🇯', 'TZ': '🇹🇿',
  'TH': '🇹🇭', 'TL': '🇹🇱', 'TG': '🇹🇬', 'TT': '🇹🇹', 'TN': '🇹🇳',
  'TR': '🇹🇷', 'TM': '🇹🇲', 'UG': '🇺🇬', 'UA': '🇺🇦', 'AE': '🇦🇪',
  'GB': '🇬🇧', 'US': '🇺🇸', 'UY': '🇺🇾', 'UZ': '🇺🇿', 'VE': '🇻🇪',
  'VN': '🇻🇳', 'YE': '🇾🇪', 'ZM': '🇿🇲', 'ZW': '🇿🇼',
};

export function resolveFlag(raw) {
  if (!raw) return '🏳️';
  const trimmed = raw.trim();
  return FLAG_MAP[trimmed]
    ?? FLAG_MAP[trimmed.toUpperCase()]
    ?? FLAG_MAP[trimmed.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())]
    ?? '🏳️';
}

export function deriveMatchType(m, wtaPlayerIds = new Set()) {
  const p1Name     = m.player1?.name ?? '';
  const p2Name     = m.player2?.name ?? '';
  const tournament = (m.tournament ?? '').toLowerCase();
  const stored     = m.match_type ?? 'atp_singles';
  const isDoubles  = p1Name.includes('/') || p2Name.includes('/');

  // Trust stored value first — set correctly at sync time
  if (stored.startsWith('itf_'))  return stored;
  if (stored.startsWith('utr_'))  return stored;
  if (stored === 'mixed_doubles') return stored;
  if (stored === 'wta_singles')   return stored;
  if (stored === 'wta_doubles')   return stored;

  // UTR fallback by tournament name
  if (tournament.includes('utr')) {
    return tournament.includes('women') ? 'utr_women_singles' : 'utr_men_singles';
  }

  // ITF fallback by tournament name
  const isItf = tournament.includes('itf') ||
    /\bw\d{2}\b/.test(tournament) || /\bm\d{2}\b/.test(tournament);
  if (isItf) {
    const isWomen = tournament.includes('women') || /\bw\d{2}\b/.test(tournament);
    if (isDoubles) return isWomen ? 'itf_women_doubles' : 'itf_men_doubles';
    return isWomen ? 'itf_women_singles' : 'itf_men_singles';
  }

  // WTA detection — only runs if stored value wasn't wta_singles/wta_doubles
  const isWtaByRankings   = wtaPlayerIds.size > 0 &&
    (wtaPlayerIds.has(m.player1?.id) || wtaPlayerIds.has(m.player2?.id));
  const isWtaByTournament = tournament.includes('wta') ||
    tournament.includes('women') || tournament.includes('ladies');
  const isWta = isWtaByRankings || isWtaByTournament;

  if (isDoubles) return isWta ? 'wta_doubles' : 'atp_doubles';
  if (isWta)     return 'wta_singles';
  return stored;
}

function normaliseMatch(m, wtaPlayerIds = new Set()) {
  // Patch missing flags on the fly
  const patchFlag = (p) => {
    if (!p) return p;
    const flag = p.flag && p.flag !== '🏳️' ? p.flag : resolveFlag(p.country ?? '');
    return { ...p, flag };
  };

  return {
    id:         m.id,
    status:     m.status,
    tournament: m.tournament,
    round:      m.round,
    surface:    m.surface,
    score:      m.score ?? null,
    date:       m.match_date,
    local_date: m.local_date ?? null,
    match_type: m.match_type ?? 'atp_singles',
    winner_id:  m.winner_id ?? null,
    player1:    patchFlag(m.player1 ?? { id: 'p1', name: 'TBD', flag: '🏳️', rank: 999 }),
    player2:    patchFlag(m.player2 ?? { id: 'p2', name: 'TBD', flag: '🏳️', rank: 999 }),
  };
}

// ── Live matches ──────────────────────────────────────────────────────────────
export async function getLiveMatches(wtaPlayerIds = new Set()) {
  try {
    const [atpWta, itf, utr, doubles] = await Promise.all([
      supabase
        .from('matches')
        .select(MATCH_SELECT)
        .eq('status', 'live')
        .in('match_type', ['atp_singles', 'wta_singles'])
        .order('match_date', { ascending: true })
        .limit(200),

      supabase
        .from('matches')
        .select(MATCH_SELECT)
        .eq('status', 'live')
        .in('match_type', ['itf_men_singles', 'itf_women_singles', 'itf_men_doubles', 'itf_women_doubles'])
        .order('match_date', { ascending: true })
        .limit(150),

      supabase
        .from('matches')
        .select(MATCH_SELECT)
        .eq('status', 'live')
        .in('match_type', ['utr_men_singles', 'utr_women_singles'])
        .order('match_date', { ascending: true })
        .limit(50),

      supabase
        .from('matches')
        .select(MATCH_SELECT)
        .eq('status', 'live')
        .in('match_type', ['atp_doubles', 'wta_doubles', 'mixed_doubles'])
        .order('match_date', { ascending: true })
        .limit(100),
    ]);

    const combined = [
      ...(atpWta.data  ?? []),
      ...(itf.data     ?? []),
      ...(utr.data     ?? []),
      ...(doubles.data ?? []),
    ];

    return combined.map(m => normaliseMatch(m, wtaPlayerIds));
  } catch (e) {
    if (e?.name === 'AbortError') return [];
    console.error('[getLiveMatches]', e.message);
    return [];
  }
}

// ── Upcoming matches ──────────────────────────────────────────────────────────
export async function getUpcomingMatches(wtaPlayerIds = new Set()) {
  try {
    const todayLocalDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
      year:     'numeric',
      month:    '2-digit',
      day:      '2-digit',
    }).format(new Date());

    const [atpWta, itf, utr, doubles] = await Promise.all([
      supabase
        .from('matches')
        .select(MATCH_SELECT)
        .eq('status', 'upcoming')
        .eq('local_date', todayLocalDate)
        .in('match_type', ['atp_singles', 'wta_singles'])
        .order('match_date', { ascending: true })
        .limit(500),

      supabase
        .from('matches')
        .select(MATCH_SELECT)
        .eq('status', 'upcoming')
        .eq('local_date', todayLocalDate)
        .in('match_type', ['itf_men_singles', 'itf_women_singles', 'itf_men_doubles', 'itf_women_doubles'])
        .order('match_date', { ascending: true })
        .limit(300),

      supabase
        .from('matches')
        .select(MATCH_SELECT)
        .eq('status', 'upcoming')
        .eq('local_date', todayLocalDate)
        .in('match_type', ['utr_men_singles', 'utr_women_singles'])
        .order('match_date', { ascending: true })
        .limit(100),

      supabase
        .from('matches')
        .select(MATCH_SELECT)
        .eq('status', 'upcoming')
        .eq('local_date', todayLocalDate)
        .in('match_type', ['atp_doubles', 'wta_doubles', 'mixed_doubles'])
        .order('match_date', { ascending: true })
        .limit(200),
    ]);

    const combined = [
      ...(atpWta.data  ?? []),
      ...(itf.data     ?? []),
      ...(utr.data     ?? []),
      ...(doubles.data ?? []),
    ];

    return combined.map(m => normaliseMatch(m, wtaPlayerIds));
  } catch (e) {
    if (e?.name === 'AbortError') return [];
    console.error('[getUpcomingMatches]', e.message);
    return [];
  }
}

// ── Matches by date ───────────────────────────────────────────────────────────
export async function getMatchesByDate(dateString, wtaPlayerIds = new Set()) {
  try {
    // Primary: use local_date column
    const { data: byLocalDate, error: e1 } = await supabase
      .from('matches')
      .select(MATCH_SELECT)
      .eq('local_date', dateString)
      .order('match_date', { ascending: true });

    if (!e1 && byLocalDate && byLocalDate.length > 0) {
      return byLocalDate.map(m => normaliseMatch(m, wtaPlayerIds));
    }

    // Fallback: ±1 day UTC window + client-side filter
    const d    = new Date(`${dateString}T12:00:00.000Z`);
    const prev = new Date(d); prev.setUTCDate(d.getUTCDate() - 1);
    const next = new Date(d); next.setUTCDate(d.getUTCDate() + 1);

    const { data, error } = await supabase
      .from('matches')
      .select(MATCH_SELECT)
      .gte('match_date', `${prev.toISOString().slice(0, 10)}T00:00:00.000Z`)
      .lte('match_date', `${next.toISOString().slice(0, 10)}T23:59:59.999Z`)
      .order('match_date', { ascending: true });

    if (error) throw error;

    return (data ?? []).map(m => normaliseMatch(m, wtaPlayerIds)).filter(m => {
      if (!m.date) return false;
      if (m.local_date) return m.local_date === dateString;
      return new Date(m.date).toLocaleDateString('en-CA') === dateString;
    });
  } catch (e) {
    if (e?.name === 'AbortError') return [];
    console.error('[getMatchesByDate]', e.message);
    return [];
  }
}

// ── Rankings (ATP/WTA from rankings table) ────────────────────────────────────
export async function getRankings(tour = 'ATP') {
  try {
    const { data, error } = await supabase
      .from('rankings')
      .select(`
        rank, points, prev_rank,
        players (
          id, name, country, flag,
          wins, losses, ace_avg,
          surface_pref, first_serve_pct, recent_form
        )
      `)
      .eq('tour', tour)
      .order('rank', { ascending: true })
      .limit(100);

    if (error) throw error;

    return (data ?? []).map(r => ({
      ...r.players,
      flag: r.players?.flag && r.players.flag !== '🏳️'
        ? r.players.flag
        : resolveFlag(r.players?.country ?? ''),
      rank:      r.rank,
      points:    r.points,
      prev_rank: r.prev_rank,
    }));
  } catch (e) {
    console.error('[getRankings]', e.message);
    return [];
  }
}

// ── Player stats ──────────────────────────────────────────────────────────────
export async function getPlayerStats(playerId) {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single();

    if (error) throw error;
    return data;
  } catch (e) {
    console.error('[getPlayerStats]', e.message);
    return null;
  }
}

// ── Head to head ──────────────────────────────────────────────────────────────
export async function getHeadToHead(p1Id, p2Id) {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('status', 'finished')
      .or(`and(player1_id.eq.${p1Id},player2_id.eq.${p2Id}),and(player1_id.eq.${p2Id},player2_id.eq.${p1Id})`)
      .order('match_date', { ascending: false })
      .limit(10);

    if (error) throw error;
    if (!data?.length) return null;

    const p1Wins = data.filter(m => m.winner_id === p1Id).length;
    const p2Wins = data.filter(m => m.winner_id === p2Id).length;

    return {
      total:    data.length,
      p1_wins:  p1Wins,
      p2_wins:  p2Wins,
      last5:    data.slice(0, 5).map(m => m.winner_id === p1Id ? 'W' : 'L'),
      meetings: data.map(m => ({
        year:       new Date(m.match_date).getFullYear(),
        tournament: m.tournament,
        surface:    m.surface,
        winner:     m.winner_id === p1Id ? 'p1' : 'p2',
        score:      m.score ?? '',
      })),
    };
  } catch (e) {
    console.error('[getHeadToHead]', e.message);
    return null;
  }
}

// ── Recent matches for a single player ───────────────────────────────────────
export async function getRecentMatches(playerId, limit = 5) {
  try {
    if (!playerId || playerId === 'p1' || playerId === 'p2') return [];
    const { data, error } = await supabase
      .from('matches')
      .select('id, tournament, surface, match_date, winner_id, score, player1_id, player2_id')
      .eq('status', 'finished')
      .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
      .order('match_date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map(m => ({
      tournament: m.tournament,
      surface:    m.surface,
      date:       m.match_date,
      score:      m.score ?? '',
      result:     m.winner_id === playerId ? 'W' : m.winner_id ? 'L' : '?',
    }));
  } catch (e) {
    console.error('[getRecentMatches]', e.message);
    return [];
  }
}

// ── AI-Powered Prediction engine ──────────────────────────────────────────────
// Uses /api/chat (Gemini) for intelligent, multi-factor analysis.
// Falls back to algorithmic prediction if AI is unavailable.
// ── AI-Powered Prediction engine ──────────────────────────────────────────────
// ── AI-Powered Prediction engine ──────────────────────────────────────────────
export async function getPrediction(match) {
  const p1 = match.player1;
  const p2 = match.player2;

  // ── 1. Classify scenario ──────────────────────────────────────────────────
  const p1HasRank    = p1.rank && p1.rank < 900;
  const p2HasRank    = p2.rank && p2.rank < 900;
  const p1HasForm    = p1.recent_form && !p1.recent_form.includes('-');
  const p2HasForm    = p2.recent_form && !p2.recent_form.includes('-');
  const p1HasServe   = p1.first_serve_pct && p1.first_serve_pct > 0;
  const p2HasServe   = p2.first_serve_pct && p2.first_serve_pct > 0;
  const p1HasFatigue = p1.fatigue_score && p1.fatigue_score > 0;
  const p2HasFatigue = p2.fatigue_score && p2.fatigue_score > 0;

  const scenario = p1HasRank && p2HasRank ? 'ranked_vs_ranked'
    : p1HasRank || p2HasRank              ? 'ranked_vs_unranked'
    :                                        'unranked_vs_unranked';

  const dataQuality = [p1HasRank, p2HasRank, p1HasForm, p2HasForm].filter(Boolean).length;

  // ── 2. Algorithmic baseline ───────────────────────────────────────────────
  let rankEdge = 0;
  if (p1HasRank && p2HasRank) {
    const diff = p2.rank - p1.rank;
    rankEdge = Math.sign(diff) * Math.min(30, Math.abs(diff) > 0
      ? Math.log(Math.abs(diff) + 1) * 5.5 : 0);
  } else if (p1HasRank && !p2HasRank) {
    rankEdge = p1.rank < 200 ? 18 : p1.rank < 500 ? 12 : 6;
  } else if (!p1HasRank && p2HasRank) {
    rankEdge = -(p2.rank < 200 ? 18 : p2.rank < 500 ? 12 : 6);
  }

  const surfaceEdge  = match.surface === p1.surface_pref ? 9 : match.surface === p2.surface_pref ? -9 : 0;
  const countWins    = (form) => (form ?? '').split('').filter(c => c === 'W').length;
  const formEdge     = (p1HasForm && p2HasForm) ? (countWins(p1.recent_form) - countWins(p2.recent_form)) * 3 : 0;
  const serveEdge    = (p1HasServe && p2HasServe) ? ((p1.first_serve_pct - p2.first_serve_pct) * 0.2) : 0;
  const aceEdge      = (p1.ace_avg && p2.ace_avg) ? ((p1.ace_avg - p2.ace_avg) * 0.6) : 0;
  const fatigueEdge  = (p1HasFatigue || p2HasFatigue) ? ((p2.fatigue_score ?? 0) - (p1.fatigue_score ?? 0)) * 1.5 : 0;

  const roundStr         = (match.round ?? '').toLowerCase();
  const roundMultiplier  = roundStr.includes('final') && !roundStr.includes('semi') && !roundStr.includes('quarter') ? 1.15
    : roundStr.includes('semi') ? 1.08 : roundStr.includes('quarter') ? 1.04 : 1.0;

  const rawPct  = 50 + (rankEdge + surfaceEdge + formEdge + serveEdge + aceEdge + fatigueEdge) * roundMultiplier;
  const basePct = Math.min(90, Math.max(10, Math.round(rawPct)));

  // ── 3. Parallel data fetch: H2H + recent matches for both players ─────────
  const [h2hData, p1Recent, p2Recent] = await Promise.allSettled([
    (p1?.id && p2?.id && p1.id !== 'p1' && p2.id !== 'p2')
      ? getHeadToHead(p1.id, p2.id) : Promise.resolve(null),
    getRecentMatches(p1?.id, 5),
    getRecentMatches(p2?.id, 5),
  ]);

  const h2h       = h2hData.status === 'fulfilled' ? h2hData.value : null;
  const p1Matches = p1Recent.status === 'fulfilled' ? p1Recent.value : [];
  const p2Matches = p2Recent.status === 'fulfilled' ? p2Recent.value : [];

  // ── 4. Format recent matches as a readable strip ──────────────────────────
  const formatRecent = (matches, playerName) => {
    if (!matches?.length) return `  ${playerName} recent matches: not available in DB`;
    const strip = matches.map(m =>
      `${m.result} (${m.tournament ?? 'Unknown'}, ${m.surface ?? '?'}, ${m.score || 'no score'})`
    ).join('\n    ');
    return `  ${playerName} last ${matches.length} matches:\n    ${strip}`;
  };

  // ── 5. H2H or recent form section for prompt ─────────────────────────────
  let h2hSection;
  if (h2h && (h2h.p1_wins + h2h.p2_wins) >= 2) {
    const total = h2h.p1_wins + h2h.p2_wins;
    let h2hText = `Head-to-head (from DB): ${p1.name} leads ${h2h.p1_wins}-${h2h.p2_wins} (${total} meetings).`;
    const surfaceMeetings = (h2h.meetings ?? []).filter(
      m => m.surface?.toLowerCase() === (match.surface ?? '').toLowerCase()
    );
    if (surfaceMeetings.length >= 2) {
      const p1SW = surfaceMeetings.filter(m => m.winner === 'p1').length;
      h2hText += ` On ${match.surface}: ${p1.name} ${p1SW}-${surfaceMeetings.length - p1SW}.`;
    }
    h2hSection = `HEAD-TO-HEAD (DB):\n  ${h2hText}\n  Last 5 results (from ${p1.name}'s perspective): ${(h2h.last5 ?? []).join(' ')}`;
  } else {
    // No H2H — show each player's recent matches instead
    h2hSection = `HEAD-TO-HEAD: No meetings in our DB. Use your own knowledge of their rivalry.\n\nRECENT FORM (from DB):\n${formatRecent(p1Matches, p1.name)}\n${formatRecent(p2Matches, p2.name)}`;
  }

  // ── 6. Data lines ─────────────────────────────────────────────────────────
  const p1DataLines = [
    p1HasRank    && `Rank: #${p1.rank}`,
    p1.country   && `Country: ${p1.country}`,
    p1.surface_pref && p1.surface_pref !== 'Hard' && `Preferred surface: ${p1.surface_pref}`,
    p1HasForm    && `Recent form (last 5): ${p1.recent_form}`,
    p1HasServe   && `1st serve %: ${p1.first_serve_pct}%`,
    p1.ace_avg   && `Aces/match: ${p1.ace_avg}`,
    (p1.wins || p1.losses) && `Season W/L: ${p1.wins ?? 0}W-${p1.losses ?? 0}L`,
    p1HasFatigue && `Fatigue score: ${p1.fatigue_score}/10`,
  ].filter(Boolean);

  const p2DataLines = [
    p2HasRank    && `Rank: #${p2.rank}`,
    p2.country   && `Country: ${p2.country}`,
    p2.surface_pref && p2.surface_pref !== 'Hard' && `Preferred surface: ${p2.surface_pref}`,
    p2HasForm    && `Recent form (last 5): ${p2.recent_form}`,
    p2HasServe   && `1st serve %: ${p2.first_serve_pct}%`,
    p2.ace_avg   && `Aces/match: ${p2.ace_avg}`,
    (p2.wins || p2.losses) && `Season W/L: ${p2.wins ?? 0}W-${p2.losses ?? 0}L`,
    p2HasFatigue && `Fatigue score: ${p2.fatigue_score}/10`,
  ].filter(Boolean);

  const p1Section = p1DataLines.length > 0
    ? p1DataLines.map(l => `  ${l}`).join('\n')
    : `  No DB stats — use your training knowledge about ${p1.name}`;

  const p2Section = p2DataLines.length > 0
    ? p2DataLines.map(l => `  ${l}`).join('\n')
    : `  No DB stats — use your training knowledge about ${p2.name}`;

  // ── 7. Fallback result ────────────────────────────────────────────────────
  const p1RecentStr = p1Matches.length ? p1Matches.map(m => m.result).join(' ') : null;
  const p2RecentStr = p2Matches.length ? p2Matches.map(m => m.result).join(' ') : null;

  const baseFactors = [
    p1HasRank && p2HasRank
      ? `Ranking: ${p1.name} #${p1.rank} vs ${p2.name} #${p2.rank}`
      : scenario === 'ranked_vs_unranked'
        ? `${p1HasRank ? p1.name : p2.name} is ATP/WTA ranked; opponent has no ranking`
        : `Neither player has an ATP/WTA rank`,
    surfaceEdge !== 0
      ? `Surface edge: ${match.surface ?? 'Hard'} favours ${surfaceEdge > 0 ? p1.name : p2.name}`
      : `Surface: ${match.surface ?? 'Hard'} — neutral for both`,
    p1HasForm && p2HasForm
      ? `Recent form: ${p1.name} ${p1.recent_form} vs ${p2.name} ${p2.recent_form}`
      : null,
    p1RecentStr ? `${p1.name} last 5 DB results: ${p1RecentStr}` : null,
    p2RecentStr ? `${p2.name} last 5 DB results: ${p2RecentStr}` : null,
    h2h && (h2h.p1_wins + h2h.p2_wins) >= 2
      ? `H2H: ${p1.name} ${h2h.p1_wins}-${h2h.p2_wins} ${p2.name}`
      : null,
  ].filter(Boolean);

  const baseResult = {
    player1_win_pct:  basePct,
    player2_win_pct:  100 - basePct,
    confidence: scenario === 'ranked_vs_ranked' && Math.abs(basePct - 50) > 25 ? 'High'
      : scenario === 'ranked_vs_ranked' && dataQuality >= 3 && Math.abs(basePct - 50) > 15 ? 'Medium'
      : 'Low',
    key_factors:      baseFactors,
    predicted_winner: basePct >= 50 ? p1.name : p2.name,
    ai_analysis:      null,
    source:           'algorithmic',
    scenario,
  };

  // ── 8. AI prediction ──────────────────────────────────────────────────────
  try {
    const dataNote = scenario === 'unranked_vs_unranked'
      ? `⚠️ CRITICAL: Neither player is ranked in our DB. Use your training knowledge entirely. If you genuinely don't recognise either player, return Low confidence 50/50 and be honest in ai_analysis.`
      : scenario === 'ranked_vs_unranked'
        ? `NOTE: One player is ranked, one is not. Use rank data + your knowledge of the unranked player.`
        : dataQuality <= 2
          ? `NOTE: DB stats are partial. Supplement with your knowledge of these players.`
          : `DB stats are complete. Use them as the primary signal.`;

    const scenarioInstruction = scenario === 'ranked_vs_ranked'
      ? `Both players are ranked. A rank gap of 50+ should produce at least 60% for the higher ranked player unless form/H2H clearly contradicts it.`
      : scenario === 'ranked_vs_unranked'
        ? `Ranked player should be favoured (55–75%) unless you know the unranked player is actually strong.`
        : `Neither player is ranked. Rely entirely on your knowledge. If unknown, be honest.`;

    const prompt = `You are an elite tennis prediction model with encyclopedic knowledge of every ATP, WTA, ITF, and challenger circuit player through early 2025.

MATCH: ${p1.name} vs ${p2.name}
TOURNAMENT: ${match.tournament ?? 'Unknown'} | ROUND: ${match.round ?? 'Unknown'} | SURFACE: ${match.surface ?? 'Hard'}
SCENARIO: ${scenario.replace(/_/g, ' ').toUpperCase()}

${dataNote}

${p1.name} (DB data):
${p1Section}

${p2.name} (DB data):
${p2Section}

${h2hSection}

ALGORITHMIC BASELINE: ${p1.name} ${basePct}% — ${p2.name} ${100 - basePct}%
${scenarioInstruction}

STEP 1 — RECALL FROM YOUR TRAINING KNOWLEDGE:
Before writing any key_factors, mentally recall:
- ${p1.name}: What were their last 3–5 match results? Win or loss, opponent name, tournament, surface. What is their current form streak?
- ${p2.name}: Same — last 3–5 results from your memory. Tournament names, surfaces, opponents.
- Have these two players met before? What was the outcome?
- Any known injuries, coaching changes, or slumps for either player right now?

STEP 2 — WRITE YOUR PREDICTION using that recalled knowledge plus the DB data above.

RULES:
- Be specific: 63%, 71%, 38% — NOT round numbers unless genuinely a coin-flip
- Confidence: "High" = clear favourite with strong evidence; "Medium" = slight edge; "Low" = genuinely close
- key_factors: EXACTLY 5 to 7. Each must be a specific factual sentence. Cover ALL these categories:
  1. Ranking/seeding comparison
  2. Surface win rate or preference — cite a real percentage or tournament if you know it
  3. Recent form — name the actual last 3–5 matches from your memory (e.g. "Won vs Medvedev in Miami R16, lost to Alcaraz in Madrid SF")
  4. Head-to-head — cite record and last meeting, or state it is a first meeting
  5. Serve or playing style matchup
  6. Tournament context, draw difficulty, or round pressure
  7. Fitness, fatigue, scheduling load, or injury if relevant — skip this one if nothing meaningful
- NEVER write generic filler like "Player A is a strong competitor" or "Both players are capable"
- ai_analysis: 2–3 sentences. Cite at least one real stat or match result from your memory. Name both players. Give a direct verdict.

Respond ONLY with valid JSON, no markdown:
{
  "player1_win_pct": <integer 8-92>,
  "confidence": "<High|Medium|Low>",
  "predicted_winner": "<exact player name>",
  "key_factors": [
    "<ranking/seeding: e.g. '${p1.name} is ranked #X vs ${p2.name} #Y — a gap of Z places'>",
    "<surface: e.g. '${p1.name} has won 78% of matches on ${match.surface ?? 'Hard'} this season'>",
    "<recent form: e.g. '${p1.name} arrives on a 4-match win streak including wins over [name] and [name]; ${p2.name} lost in R1 at [tournament] last week'>",
    "<H2H: e.g. '${p1.name} leads the H2H 4-2, winning their last meeting at [tournament] in [year] [score]' or 'First career meeting between these two players'>",
    "<serve/style: specific edge one player has over the other on this surface>",
    "<tournament context: seeding, draw, conditions, pressure>",
    "<fitness/wildcard: only if genuinely relevant, otherwise omit this item>"
  ],
  "ai_analysis": "<2-3 sentences with a real stat or match result from your memory, both players named, direct verdict>"
}`;

    const predRes = await fetch('/api/predict', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ prompt }),
    });

    if (!predRes.ok) {
      const errJson = await predRes.json().catch(() => ({}));
      if (predRes.status === 429) throw new Error(errJson.message ?? 'AI is busy, try again shortly');
      throw new Error(`Predict API error ${predRes.status}`);
    }

    const response = await predRes.json();
    const rawText  = response?.content?.[0]?.text ?? '';
    const cleaned  = rawText.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    const parsed   = JSON.parse(cleaned);

    if (
      typeof parsed.player1_win_pct === 'number' &&
      parsed.player1_win_pct >= 5  &&
      parsed.player1_win_pct <= 95 &&
      parsed.confidence &&
      parsed.ai_analysis
    ) {
      const aiPct = Math.min(92, Math.max(8, Math.round(parsed.player1_win_pct)));

      const isLazy50    = aiPct === 50 && Math.abs(basePct - 50) > 10;
      let blendedPct;
      if (isLazy50)                              blendedPct = Math.round(aiPct * 0.5 + basePct * 0.5);
      else if (scenario === 'unranked_vs_unranked') blendedPct = aiPct;
      else if (scenario === 'ranked_vs_unranked')   blendedPct = Math.round(aiPct * 0.7 + basePct * 0.3);
      else                                           blendedPct = Math.round(aiPct * 0.8 + basePct * 0.2);
      blendedPct = Math.min(92, Math.max(8, blendedPct));

      return {
        player1_win_pct:  blendedPct,
        player2_win_pct:  100 - blendedPct,
        confidence:       parsed.confidence,
        key_factors: (parsed.key_factors ?? []).filter(
          f => f && !f.includes('<') && !f.toLowerCase().includes('factor') && f.length > 10
        ),
        predicted_winner: blendedPct >= 50 ? p1.name : p2.name,
        ai_analysis:      parsed.ai_analysis,
        source:           'ai',
        scenario,
      };
    }
  } catch (e) {
    console.warn('[getPrediction] AI failed, using algorithmic fallback:', e.message);
  }

  return baseResult;
}

// ── AI Chat ───────────────────────────────────────────────────────────────────
export async function sendChatMessage(messages, systemContext = '') {
  const res = await fetch('/api/chat', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ messages, systemContext }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chat error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ── Mock data fallback ────────────────────────────────────────────────────────
export const MOCK_DATA = {
  matches:  [],
  players:  [],
  rankings: [],
};