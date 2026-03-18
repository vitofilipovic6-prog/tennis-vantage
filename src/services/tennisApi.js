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

  const isDoubles = p1Name.includes('/') || p2Name.includes('/');

  // Trust stored value for ITF and UTR — set correctly at sync time
  if (stored.startsWith('itf_') || stored.startsWith('utr_')) return stored;

  // UTR by name (fallback for old rows)
  if (tournament.includes('utr')) {
    const isWomen = tournament.includes('women');
    return isWomen ? 'utr_women_singles' : 'utr_men_singles';
  }

  // ITF by name (fallback for old rows)
  const isItfByName = tournament.includes('itf') ||
    /\bw\d{2}\b/.test(tournament) ||
    /\bm\d{2}\b/.test(tournament);

  if (isItfByName) {
    const isWomen = tournament.includes('women') || /\bw\d{2}\b/.test(tournament);
    if (isDoubles) return isWomen ? 'itf_women_doubles' : 'itf_men_doubles';
    return isWomen ? 'itf_women_singles' : 'itf_men_singles';
  }

  const p1IsWta         = wtaPlayerIds.size > 0 && wtaPlayerIds.has(m.player1?.id);
  const p2IsWta         = wtaPlayerIds.size > 0 && wtaPlayerIds.has(m.player2?.id);
  const isWtaByRankings = p1IsWta || p2IsWta;
  const isWtaByTournament = tournament.includes('wta') ||
    tournament.includes('women') || tournament.includes('ladies');
  const isWtaByStored   = stored === 'wta_singles' || stored === 'wta_doubles';
  const isMixedByStored = stored === 'mixed_doubles';
  const isWta = isWtaByRankings || isWtaByTournament || isWtaByStored;

  if (isDoubles) {
    if (isMixedByStored) return 'mixed_doubles';
    if (isWta)           return 'wta_doubles';
    return 'atp_doubles';
  }

  if (isWta) return 'wta_singles';
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
    const { data, error } = await supabase
      .from('matches')
      .select(MATCH_SELECT)
      .eq('status', 'live')
      .order('match_date', { ascending: true })
      .limit(30);

    if (error) throw error;
    return (data ?? []).map(m => normaliseMatch(m, wtaPlayerIds));
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

    // Fetch today + next 2 days only (keeps result set small & relevant)
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);
    const maxLocalDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
      year:     'numeric',
      month:    '2-digit',
      day:      '2-digit',
    }).format(threeDaysLater);

    const { data, error } = await supabase
      .from('matches')
      .select(MATCH_SELECT)
      .eq('status', 'upcoming')
      .gte('local_date', todayLocalDate)
      .lte('local_date', maxLocalDate)   // ← don't pull weeks of future matches
      .order('local_date', { ascending: true })
      .order('match_date', { ascending: true })
      .limit(150);                        // ← raised from 50, today alone can have 100+

    if (error) throw error;
    return (data ?? []).map(m => normaliseMatch(m, wtaPlayerIds));
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

// ── AI-Powered Prediction engine ──────────────────────────────────────────────
// Uses /api/chat (Gemini) for intelligent, multi-factor analysis.
// Falls back to algorithmic prediction if AI is unavailable.
// ── AI-Powered Prediction engine ──────────────────────────────────────────────
export async function getPrediction(match) {
  const p1 = match.player1;
  const p2 = match.player2;

  // ── Determine how much real data we actually have ─────────────────────────
  const p1HasRank    = p1.rank && p1.rank < 900;
  const p2HasRank    = p2.rank && p2.rank < 900;
  const p1HasForm    = p1.recent_form && !p1.recent_form.includes('-');
  const p2HasForm    = p2.recent_form && !p2.recent_form.includes('-');
  const p1HasServe   = p1.first_serve_pct && p1.first_serve_pct > 0;
  const p2HasServe   = p2.first_serve_pct && p2.first_serve_pct > 0;
  const p1HasSurface = p1.surface_pref && p1.surface_pref !== 'Hard';
  const p2HasSurface = p2.surface_pref && p2.surface_pref !== 'Hard';

  const dataQuality = [p1HasRank, p2HasRank, p1HasForm, p2HasForm].filter(Boolean).length;
  // 0-1 = almost no data, 2-3 = partial, 4 = full

  // ── Algorithmic baseline (only meaningful when we have real ranks) ─────────
  const rankDiff  = p1HasRank && p2HasRank ? (p2.rank - p1.rank) : 0;
  const rankEdge  = p1HasRank && p2HasRank
    ? Math.min(22, Math.max(-22, rankDiff * 0.8))
    : 0;

  const surfaceEdge = match.surface === p1.surface_pref ? 7
    : match.surface === p2.surface_pref ? -7 : 0;

  const countWins  = (form) => (form ?? '').split('').filter(c => c === 'W').length;
  const formEdge   = (p1HasForm && p2HasForm)
    ? (countWins(p1.recent_form) - countWins(p2.recent_form)) * 2
    : 0;

  const serveEdge = (p1HasServe && p2HasServe)
    ? ((p1.first_serve_pct - p2.first_serve_pct) * 0.15)
    : 0;

  const aceEdge = (p1.ace_avg && p2.ace_avg)
    ? ((p1.ace_avg - p2.ace_avg) * 0.5)
    : 0;

  const rawPct  = 50 + rankEdge + surfaceEdge + formEdge + serveEdge + aceEdge;
  const basePct = Math.min(88, Math.max(12, Math.round(rawPct)));

  // Build human-readable data summary for prompt (only include real values)
  const p1DataLines = [
    p1HasRank    && `Rank: #${p1.rank}`,
    p1.country   && `Country: ${p1.country}`,
    p1HasSurface && `Preferred surface: ${p1.surface_pref}`,
    p1HasForm    && `Recent form (last 5): ${p1.recent_form}`,
    p1HasServe   && `1st serve %: ${p1.first_serve_pct}%`,
    p1.ace_avg   && `Aces/match: ${p1.ace_avg}`,
    (p1.wins || p1.losses) && `Season W/L: ${p1.wins ?? 0}W-${p1.losses ?? 0}L`,
  ].filter(Boolean);

  const p2DataLines = [
    p2HasRank    && `Rank: #${p2.rank}`,
    p2.country   && `Country: ${p2.country}`,
    p2HasSurface && `Preferred surface: ${p2.surface_pref}`,
    p2HasForm    && `Recent form (last 5): ${p2.recent_form}`,
    p2HasServe   && `1st serve %: ${p2.first_serve_pct}%`,
    p2.ace_avg   && `Aces/match: ${p2.ace_avg}`,
    (p2.wins || p2.losses) && `Season W/L: ${p2.wins ?? 0}W-${p2.losses ?? 0}L`,
  ].filter(Boolean);

  // ── Build fallback result (used if AI fails) ──────────────────────────────
  const baseFactors = [
    p1HasRank && p2HasRank
      ? `Ranking: #${p1.rank} vs #${p2.rank} (${rankDiff > 0 ? '+' : ''}${rankDiff} spots)`
      : `Rankings unavailable — prediction based on AI knowledge`,
    surfaceEdge !== 0
      ? `Surface: ${match.surface ?? 'Hard'} — ${surfaceEdge > 0 ? p1.name : p2.name} has a surface advantage`
      : `Surface: ${match.surface ?? 'Hard'} (neutral)`,
    p1HasForm && p2HasForm
      ? `Recent form: ${p1.recent_form} vs ${p2.recent_form}`
      : null,
  ].filter(Boolean);

  const baseResult = {
    player1_win_pct:  basePct,
    player2_win_pct:  100 - basePct,
    confidence:       dataQuality >= 3 && Math.abs(basePct - 50) > 10 ? 'Medium' : 'Low',
    key_factors:      baseFactors,
    predicted_winner: basePct >= 50 ? p1.name : p2.name,
    ai_analysis:      null,
    source:           'algorithmic',
  };

  // ── AI Prediction ─────────────────────────────────────────────────────────
  try {
    // When DB data is sparse, explicitly tell Gemini to rely on its own knowledge
    const dataNote = dataQuality <= 1
      ? `NOTE: Our database has limited stats for these players. You MUST use your own training knowledge about ${p1.name} and ${p2.name} to produce an accurate prediction. Do not default to 50/50.`
      : dataQuality <= 3
        ? `NOTE: DB stats are partial. Supplement missing data with your own knowledge of these players.`
        : `DB stats are complete. Use them alongside your own knowledge.`;

    const p1Section = p1DataLines.length > 0
      ? p1DataLines.map(l => `  ${l}`).join('\n')
      : `  No DB stats — use your training knowledge about ${p1.name}`;

    const p2Section = p2DataLines.length > 0
      ? p2DataLines.map(l => `  ${l}`).join('\n')
      : `  No DB stats — use your training knowledge about ${p2.name}`;

    const prompt = `You are an elite tennis prediction model with encyclopedic knowledge of every ATP and WTA player.

MATCH: ${p1.name} vs ${p2.name}
TOURNAMENT: ${match.tournament ?? 'Unknown'} | ROUND: ${match.round ?? 'Unknown'} | SURFACE: ${match.surface ?? 'Hard'}

${dataNote}

${p1.name} (DB data):
${p1Section}

${p2.name} (DB data):
${p2Section}

ALGORITHMIC BASELINE (DB-only, may be unreliable if data is sparse): ${p1.name} ${basePct}% — ${p2.name} ${100 - basePct}%

Using your deep knowledge of these two players — their ATP/WTA ranking history, head-to-head record, playing style, ${match.surface ?? 'Hard'} court win percentage, Grand Slam results, current season form, and any known injuries or fatigue — give a precise prediction.

RULES:
- Be specific: 63%, 71%, 38% — NOT round numbers like 55%, 60%, 50% unless genuinely a toss-up
- If you recognise both players, your knowledge trumps the algorithmic baseline
- If one player is clearly superior on this surface historically, reflect that strongly (e.g. 75%+)
- Confidence: "High" if you are certain of the outcome, "Medium" if form is close, "Low" if genuinely uncertain
- key_factors must name both players and cite real stats, not generic statements

Respond ONLY with valid JSON, no markdown:
{
  "player1_win_pct": <integer 8-92>,
  "confidence": "<High|Medium|Low>",
  "predicted_winner": "<exact player name>",
  "key_factors": [
    "<real stat or historical fact about ${p1.name} on ${match.surface ?? 'Hard'}>",
    "<real head-to-head or rivalry fact between ${p1.name} and ${p2.name}>",
    "<form, fitness, or tournament context factor>"
  ],
  "ai_analysis": "<1-2 sentences: one concrete stat, one verdict. Name both players. Be direct and confident.>"
}`;

    const response = await sendChatMessage(
      [{ role: 'user', content: prompt }],
      'You are a professional tennis prediction AI with deep knowledge of all ATP and WTA players. Respond only with valid JSON. Never use placeholder text. Always name real players and cite real statistics.'
    );

    const rawText = response?.content?.[0]?.text ?? '';
    const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    const parsed  = JSON.parse(cleaned);

    if (
      typeof parsed.player1_win_pct === 'number' &&
      parsed.player1_win_pct >= 5  &&
      parsed.player1_win_pct <= 95 &&
      parsed.confidence &&
      parsed.ai_analysis
    ) {
      const aiPct = Math.min(92, Math.max(8, Math.round(parsed.player1_win_pct)));

      // If AI returns 50 but we have real rank data showing a clear favourite,
      // blend: 60% AI + 40% algorithmic to avoid lazy coin-flip outputs
      const blendedPct = (aiPct === 50 && dataQuality >= 2 && Math.abs(basePct - 50) > 8)
        ? Math.round(aiPct * 0.6 + basePct * 0.4)
        : aiPct;

      return {
        player1_win_pct:  blendedPct,
        player2_win_pct:  100 - blendedPct,
        confidence:       parsed.confidence,
        key_factors:      (parsed.key_factors ?? []).filter(f =>
          // Filter out any generic placeholder factors Gemini might slip in
          f && !f.includes('<') && !f.includes('factor') && f.length > 10
        ),
        predicted_winner: blendedPct >= 50 ? p1.name : p2.name,
        ai_analysis:      parsed.ai_analysis,
        source:           'ai',
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