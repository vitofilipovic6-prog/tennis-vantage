// supabase/functions/_shared/normalize.ts
//
// CHANGES IN THIS VERSION:
//  + FLAG_MAP massively expanded — covers all ~200 countries with full names,
//    3-letter ISO (incl. ATP/WTA variant codes like SUI, GER, DEN), 2-letter ISO
//  + resolveFlag now does case-insensitive + title-case fallback
//  + All prior logic preserved: detectSurface, resolveTour, resolveMatchType,
//    normalizeEvent, normalizePlayerFromMatch, normalizeRanking
// ─────────────────────────────────────────────────────────────────────────────

export interface PlayerRow {
  id: string;
  name: string;
  country: string;
  flag: string;
  rank: number;
  wins: number;
  losses: number;
  ace_avg: number;
  surface_pref: string;
  first_serve_pct: number;
  recent_form: string;
  injury_notes: string | null;
  fatigue_score: number;
}

export interface MatchRow {
  id: string;
  status: 'live' | 'upcoming' | 'finished';
  tournament: string;
  round: string;
  surface: string;
  score: string | null;
  match_date: string;
  local_date: string;
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  match_type:
    | 'atp_singles' | 'wta_singles'
    | 'itf_men_singles' | 'itf_women_singles'
    | 'utr_men_singles' | 'utr_women_singles'
    | 'atp_doubles' | 'wta_doubles'
    | 'itf_men_doubles' | 'itf_women_doubles'
    | 'mixed_doubles';
}

export interface RankingRow {
  player_id: string;
  tour: 'ATP' | 'WTA';
  rank: number;
  points: number;
  prev_rank: number | null;
}

// ── Country → Flag emoji lookup ───────────────────────────────────────────────
// Covers: full country names, 3-letter ISO (ATP/WTA codes), 2-letter ISO
const FLAG_MAP: Record<string, string> = {
  // ── Full country names ──
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
  'Taiwan': '🇹🇼', 'Chinese Taipei': '🇹🇼', 'Tajikistan': '🇹🇯', 'Tanzania': '🇹🇿',
  'Thailand': '🇹🇭', 'Timor-Leste': '🇹🇱', 'Togo': '🇹🇬', 'Trinidad and Tobago': '🇹🇹',
  'Tunisia': '🇹🇳', 'Turkey': '🇹🇷', 'Turkmenistan': '🇹🇲', 'Uganda': '🇺🇬',
  'Ukraine': '🇺🇦', 'United Arab Emirates': '🇦🇪', 'UAE': '🇦🇪',
  'United Kingdom': '🇬🇧', 'Great Britain': '🇬🇧', 'England': '🇬🇧',
  'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'United States': '🇺🇸', 'USA': '🇺🇸', 'United States of America': '🇺🇸',
  'Uruguay': '🇺🇾', 'Uzbekistan': '🇺🇿', 'Venezuela': '🇻🇪', 'Vietnam': '🇻🇳',
  'Yemen': '🇾🇪', 'Zambia': '🇿🇲', 'Zimbabwe': '🇿🇼',

  // ── 3-letter ISO + ATP/WTA variant codes ──
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

// ── Detect surface from tournament name / court type string ───────────────────
export function detectSurface(tournamentName: string, courtType?: string): string {
  const str = `${tournamentName} ${courtType ?? ''}`.toLowerCase();
  if (str.includes('clay') || str.includes('roland') || str.includes('monte') ||
    str.includes('madrid') || str.includes('rome') || str.includes('barcelona') ||
    str.includes('hamburg') || str.includes('munich') || str.includes('estoril') ||
    str.includes('bucharest') || str.includes('bastad') || str.includes('gstaad'))
    return 'Clay';
  if (str.includes('grass') || str.includes('wimbledon') || str.includes('queen') ||
    str.includes('halle') || str.includes('eastbourne') || str.includes('hertogenbosch') ||
    str.includes('newport') || str.includes('s-hertogenbosch'))
    return 'Grass';
  return 'Hard';
}

// ── Resolve flag emoji from any country string format ────────────────────────
// Multi-pass: exact → uppercase → title-case → gives up
export function resolveFlag(raw: string): string {
  if (!raw) return '🏳️';
  const trimmed = raw.trim();
  if (!trimmed) return '🏳️';
  // 1. Exact match
  if (FLAG_MAP[trimmed]) return FLAG_MAP[trimmed];
  // 2. ALL-CAPS (most ISO codes arrive uppercase)
  const up = trimmed.toUpperCase();
  if (FLAG_MAP[up]) return FLAG_MAP[up];
  // 3. Title-case (full names sometimes arrive lowercase)
  const titleCase = trimmed.replace(/\b\w/g, (c) => c.toUpperCase());
  if (FLAG_MAP[titleCase]) return FLAG_MAP[titleCase];
  // 4. Give up
  return '🏳️';
}

// ── Slugify a player name into a stable ID ────────────────────────────────────
function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// ── Compute local_date accounting for global tournament timezones ─────────────
// Miami/Indian Wells = UTC-4/5, EU = UTC+1/2, Asia = UTC+8/9
// Strategy: take the MINIMUM date across key tennis timezones so a late Miami
// match (11 PM ET = next UTC day) always lands on the correct local date.
function computeLocalDate(timestampSeconds: number): string {
  if (!timestampSeconds || timestampSeconds <= 0) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
  }

  const d = new Date(timestampSeconds * 1000);

  // Use Paris as primary — it's CET/CEST and covers most European tournaments.
  // For US tournaments (Miami, Indian Wells), the match_date stored in DB is
  // already the correct local date from the API, so Paris tz is close enough
  // and avoids the "minimum date" bug that was shifting EU matches one day back.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function resolveTour(event: any): 'ATP' | 'WTA' | 'ITF' | 'UTR' | null {
  const homeGender = String(event?.homeTeam?.gender ?? '').toUpperCase();
  const awayGender = String(event?.awayTeam?.gender ?? '').toUpperCase();

  const tournamentName = String(
    event?.tournament?.uniqueTournament?.name ??
    event?.tournament?.name ??
    event?.season?.name ?? ''
  ).toLowerCase();

  const categorySlug = String(
    event?.tournament?.category?.slug ??
    event?.tournament?.uniqueTournament?.category?.slug ?? ''
  ).toLowerCase();

  // Hard block: junk events
  const hardBlocked = ['junior', 'u18', 'u16', 'u14', 'wheelchair', 'exhibition', 'invitational', 'legends'];
  for (const kw of hardBlocked) {
    if (tournamentName.includes(kw) || categorySlug.includes(kw)) return null;
  }

  if (tournamentName.includes('utr') || categorySlug.includes('utr')) return 'UTR';

  const bothFemale = homeGender === 'F' && awayGender === 'F';
  const bothMale   = homeGender === 'M' && awayGender === 'M';
  const mixed      = (homeGender === 'M' && awayGender === 'F') ||
                     (homeGender === 'F' && awayGender === 'M');

  if (bothFemale) return 'WTA';
  if (bothMale)   return 'ATP';
  if (mixed)      return 'ATP';

  if (categorySlug.includes('wta')) return 'WTA';
  if (categorySlug.includes('atp')) return 'ATP';

  if (tournamentName.includes('wta') || tournamentName.includes('women') ||
      tournamentName.includes('ladies')) return 'WTA';

  const isItf = tournamentName.includes('itf') || categorySlug.includes('itf') ||
    /\bw\d{2}\b/.test(tournamentName) || /\bm\d{2}\b/.test(tournamentName);
  if (isItf) return 'ITF';

  if (categorySlug.includes('atp') || tournamentName.includes('atp') ||
      tournamentName.includes('challenger') || tournamentName.includes('open') ||
      tournamentName.includes('masters')) return 'ATP';

  if (event?.homeTeam?.name && event?.awayTeam?.name) return 'ATP';
  return null;
}

export function resolveMatchType(
  event: any
): 'atp_singles' | 'wta_singles' | 'itf_men_singles' | 'itf_women_singles' |
   'utr_men_singles' | 'utr_women_singles' |
   'atp_doubles' | 'wta_doubles' | 'itf_men_doubles' | 'itf_women_doubles' |
   'mixed_doubles' {

  const homeName   = String(event?.homeTeam?.name ?? '');
  const awayName   = String(event?.awayTeam?.name ?? '');
  const homeGender = String(event?.homeTeam?.gender ?? '').toUpperCase();
  const awayGender = String(event?.awayTeam?.gender ?? '').toUpperCase();

  const tournamentName = String(
    event?.tournament?.uniqueTournament?.name ??
    event?.tournament?.name ?? ''
  ).toLowerCase();
  const categorySlug = String(
    event?.tournament?.category?.slug ?? ''
  ).toLowerCase();

  const isDoubles = homeName.includes('/') || awayName.includes('/');

  const isUtr = tournamentName.includes('utr') || categorySlug.includes('utr');
  if (isUtr) {
    const isWomen = homeGender === 'F' || awayGender === 'F' || tournamentName.includes('women');
    return isWomen ? 'utr_women_singles' : 'utr_men_singles';
  }

  const isItf = tournamentName.includes('itf') || categorySlug.includes('itf') ||
    /\bw\d{2}\b/.test(tournamentName) || /\bm\d{2}\b/.test(tournamentName);

  const bothFemale   = homeGender === 'F' && awayGender === 'F';
  const bothMale     = homeGender === 'M' && awayGender === 'M';
  const eitherFemale = homeGender === 'F' || awayGender === 'F';

  if (isItf && !bothFemale && !bothMale) {
    const isWomen = eitherFemale || tournamentName.includes('women') ||
      /\bw\d{2}\b/.test(tournamentName);
    if (isDoubles) return isWomen ? 'itf_women_doubles' : 'itf_men_doubles';
    return isWomen ? 'itf_women_singles' : 'itf_men_singles';
  }

  if (isItf && bothFemale) {
    if (isDoubles) return 'itf_women_doubles';
    return 'itf_women_singles';
  }

  if (isItf && bothMale) {
    if (isDoubles) return 'itf_men_doubles';
    return 'itf_men_singles';
  }

  if (isDoubles) {
    const isMixed = (homeGender === 'M' && awayGender === 'F') ||
                    (homeGender === 'F' && awayGender === 'M');
    if (isMixed)    return 'mixed_doubles';
    if (bothFemale) return 'wta_doubles';
    if (bothMale)   return 'atp_doubles';
    if (categorySlug.includes('wta')) return 'wta_doubles';
    return 'atp_doubles';
  }

  if (bothFemale) return 'wta_singles';
  if (eitherFemale && (homeGender === '' || awayGender === '')) return 'wta_singles';
  return 'atp_singles';
}

// ── normalizeEvent — PRIMARY entry point ─────────────────────────────────────
export function normalizeEvent(
  raw: any,
  statusOverride?: 'live' | 'upcoming' | 'finished'
): { match: MatchRow; p1: PlayerRow; p2: PlayerRow } | null {
  const matchId = String(raw?.id ?? '');
  const p1Name  = String(raw?.homeTeam?.name ?? '');
  const p2Name  = String(raw?.awayTeam?.name ?? '');
  const p1Id    = String(raw?.homeTeam?.id ?? slugify(p1Name));
  const p2Id    = String(raw?.awayTeam?.id ?? slugify(p2Name));

  if (!matchId || !p1Name || !p2Name) return null;

  let status: 'live' | 'upcoming' | 'finished' = statusOverride ?? 'upcoming';
  if (!statusOverride) {
    const type = String(raw?.status?.type ?? '').toLowerCase();
    const code = Number(raw?.status?.code ?? 0);
    if (type === 'inprogress') status = 'live';
    else if (type === 'finished' || code === 100) status = 'finished';
    else if (code === 31) status = 'finished';
    else if (type === 'notstarted') status = 'upcoming';
  }

  const tournamentName = String(
    raw?.tournament?.uniqueTournament?.name ?? raw?.tournament?.name ?? 'Unknown Tournament'
  );
  const round = String(raw?.roundInfo?.name ?? raw?.roundInfo?.round ?? '');

  const groundType = String(raw?.tournament?.uniqueTournament?.groundType ?? raw?.groundType ?? '');
  const surface = detectSurface(tournamentName, groundType);

  let score: string | null = null;
  if (raw?.homeScore != null && raw?.awayScore != null) {
    const sets: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const hSet = raw.homeScore[`period${i}`];
      const aSet = raw.awayScore[`period${i}`];
      if (hSet == null && aSet == null) break;
      const hTb = raw.homeScore[`period${i}TieBreak`];
      const aTb = raw.awayScore[`period${i}TieBreak`];
      if (hTb != null)      sets.push(`${hSet}(${hTb})-${aSet}`);
      else if (aTb != null) sets.push(`${hSet}-${aSet}(${aTb})`);
      else                  sets.push(`${hSet}-${aSet}`);
    }
    if (sets.length > 0) score = sets.join(', ');
    else if (raw.homeScore.current != null) score = `${raw.homeScore.current}-${raw.awayScore.current}`;
  }

  const ts = Number(raw?.startTimestamp ?? 0);
  const match_date = ts > 0 ? new Date(ts * 1000).toISOString() : new Date().toISOString();
  const local_date = ts > 0 ? computeLocalDate(ts) : new Date().toLocaleDateString('en-CA');

  let winner_id: string | null = null;
  if (status === 'finished' && raw?.winnerCode != null) {
    winner_id = raw.winnerCode === 1 ? p1Id : raw.winnerCode === 2 ? p2Id : null;
  }

  const match_type = resolveMatchType(raw);

  const isDoubles = p1Name.includes('/') || p2Name.includes('/');

  const buildPlayer = (team: any, id: string, name: string): PlayerRow => {
    let countryRaw = String(
      team?.country?.alpha3 ?? team?.country?.alpha2 ??
      team?.country?.name ?? team?.country?.slug ?? ''
    );

    // For doubles, the API sometimes sends players as "A / B" with one country code.
    // If the name contains "/" but the country does not, duplicate the country
    // so Flag.jsx can render both flags correctly (e.g. "ITA" → "ITA/ITA").
    if (isDoubles && name.includes('/') && countryRaw && !countryRaw.includes('/')) {
      countryRaw = `${countryRaw}/${countryRaw}`;
    }

    return {
      id, name,
      country: countryRaw,
      flag: resolveFlag(countryRaw.split('/')[0] ?? countryRaw),
      rank: Number(team?.ranking ?? team?.currentRanking ?? 999),
      wins: 0, losses: 0, ace_avg: 5.5,
      surface_pref: surface, first_serve_pct: 60,
      recent_form: '- - - - -', injury_notes: null, fatigue_score: 0,
    };
  };

  const match: MatchRow = {
    id: matchId, status, tournament: tournamentName,
    round, surface, score, match_date, local_date,
    player1_id: p1Id, player2_id: p2Id, winner_id, match_type,
  };

  return {
    match,
    p1: buildPlayer(raw?.homeTeam, p1Id, p1Name),
    p2: buildPlayer(raw?.awayTeam, p2Id, p2Name),
  };
}

// ── normalizeMatch — LEGACY entry point ──────────────────────────────────────
export function normalizeMatch(
  raw: Record<string, unknown>,
  statusOverride?: 'live' | 'upcoming' | 'finished'
): MatchRow | null {
  const p1Name  = String(raw.match_hometeam_name ?? raw.home_player_name ?? raw.player1_name ?? '');
  const p2Name  = String(raw.match_awayteam_name ?? raw.away_player_name ?? raw.player2_name ?? '');
  const matchId = String(raw.match_id ?? raw.id ?? '');

  if (!matchId || !p1Name || !p2Name) return null;

  const p1Id = String(raw.match_hometeam_id ?? raw.home_player_id ?? raw.player1_id ?? slugify(p1Name));
  const p2Id = String(raw.match_awayteam_id ?? raw.away_player_id ?? raw.player2_id ?? slugify(p2Name));

  let status: 'live' | 'upcoming' | 'finished' = statusOverride ?? 'upcoming';
  if (!statusOverride) {
    const s = String(raw.match_status ?? raw.status ?? '').toLowerCase();
    if (['1h', '2h', 'in_play', 'inprogress', 'live'].some(k => s.includes(k))) status = 'live';
    else if (['ft', 'aet', 'finished', 'complete'].some(k => s.includes(k))) status = 'finished';
  }

  const tournament = String(raw.league_name ?? raw.tournament ?? raw.event_name ?? 'Unknown Tournament');
  const round      = String(raw.match_round ?? raw.round ?? raw.stage ?? '');
  const surface    = detectSurface(tournament, String(raw.surface ?? raw.court_type ?? ''));

  let score: string | null = null;
  const h = raw.match_hometeam_score ?? raw.home_score;
  const a = raw.match_awayteam_score ?? raw.away_score;
  if (h != null && a != null) score = `${h} - ${a}`;

  const rawDate    = String(raw.match_date ?? raw.date ?? '');
  const rawTime    = String(raw.match_time ?? raw.time ?? '00:00:00');
  const match_date = rawDate ? new Date(`${rawDate}T${rawTime}`).toISOString() : new Date().toISOString();
  const local_date = rawDate ? rawDate : new Date().toLocaleDateString('en-CA');

  return {
    id: matchId, status, tournament, round, surface, score,
    match_date, local_date,
    player1_id: p1Id, player2_id: p2Id,
    winner_id: null, match_type: 'atp_singles',
  };
}

// ── normalizePlayerFromMatch ─────────────────────────────────────────────────
export function normalizePlayerFromMatch(
  raw: Record<string, unknown>,
  playerId: string,
  playerName: string,
  side: 'home' | 'away'
): PlayerRow {
  const pfx     = side === 'home' ? 'match_hometeam_' : 'match_awayteam_';
  const country = String(raw[`${pfx}country`] ?? raw.player_country ?? raw.country ?? '').toUpperCase().slice(0, 3);
  return {
    id: playerId, name: playerName, country,
    flag: resolveFlag(country),
    rank: Number(raw[`${pfx}rank`] ?? raw.player_rank ?? raw.rank ?? 999),
    wins: Number(raw[`${pfx}wins`] ?? raw.player_wins ?? 0),
    losses: Number(raw[`${pfx}losses`] ?? raw.player_losses ?? 0),
    ace_avg: Number(raw.ace_avg ?? 5.5),
    surface_pref: String(raw.surface_pref ?? 'Hard'),
    first_serve_pct: Number(raw.first_serve_pct ?? 60),
    recent_form: String(raw.recent_form ?? '- - - - -'),
    injury_notes: raw.injury_notes ? String(raw.injury_notes) : null,
    fatigue_score: 0,
  };
}

// ── normalizeRankingRow ───────────────────────────────────────────────────────
export function normalizeRankingRow(
  raw: any,
  tour: 'ATP' | 'WTA',
  position: number
): { ranking: RankingRow; player: PlayerRow } {
  const rank     = Number(raw.ranking ?? raw.standing_place ?? raw.rank ?? position);
  const playerId = String(raw.team?.id ?? raw.player_id ?? raw.id ?? slugify(String(raw.team?.name ?? raw.name ?? '')));
  const name     = String(raw.team?.name ?? raw.player_name ?? raw.name ?? 'Unknown');

  const countryRaw = String(
    raw.team?.country?.alpha3 ?? raw.team?.country?.alpha2 ??
    raw.team?.country?.name ?? raw.player?.country?.name ?? raw.country ?? ''
  );

  const player: PlayerRow = {
    id: playerId, name, country: countryRaw,
    flag: resolveFlag(countryRaw),
    rank,
    wins:           Number(raw.wins ?? 0),
    losses:         Number(raw.losses ?? 0),
    ace_avg:        5.5,
    surface_pref:   'Hard',
    first_serve_pct: 60,
    recent_form:    '- - - - -',
    injury_notes:   null,
    fatigue_score:  0,
  };

  const ranking: RankingRow = {
    player_id: playerId, tour, rank,
    points:    Number(raw.points ?? raw.standing_points ?? raw.point ?? 0),
    prev_rank: raw.previousRanking ? Number(raw.previousRanking) : null,
  };

  return { ranking, player };
}

// Backward-compat alias
export const normalizeRanking = normalizeRankingRow;