import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import { useDistrictHeatmap } from '../hooks/useApi';

interface DistrictStats {
  district: string;
  flaggedCount: number;
  totalCount: number;
  avgRisk: number;
}

interface HeatMapProps {
  onSelectDistrict?: (districtName: string) => void;
  selectedDistrict?: string | null;
}

export const HeatMap: React.FC<HeatMapProps> = ({
  onSelectDistrict,
  selectedDistrict,
}) => {
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [geoLoading, setGeoLoading] = useState<boolean>(true);

  // Self-fetches all 767 districts from a dedicated server-side SQL aggregate.
  // Completely independent of the paginated worklist — no more Top-50 cap.
  const { data: heatmapData, loading: dataLoading } = useDistrictHeatmap();

  // Map API snake_case fields → internal DistrictStats shape
  const districtData: DistrictStats[] = useMemo(() =>
    (heatmapData || []).map((d) => ({
      district: d.district,
      totalCount: d.total_count,
      flaggedCount: d.flagged_count,
      avgRisk: d.avg_risk_score,
    })),
    [heatmapData]
  );

  const loading = geoLoading || dataLoading;

  // Load geojson from /india_districts.geojson
  useEffect(() => {
    fetch('/india_districts.geojson')
      .then((res) => res.json())
      .then((data) => {
        setGeoJsonData(data);
        setGeoLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load india_districts.geojson:', err);
        setGeoLoading(false);
      });
  }, []);

  // Alias table: DB district name → canonical GeoJSON 'district' property name.
  // Covers spelling variants, renamed districts, and post-2011 carved districts
  // mapped to their parent GeoJSON boundary.
  const DISTRICT_ALIASES: Record<string, string> = {
    "Kataka":"Cuttack","Nayagada":"Nayagarh","Baragada":"Bargarh","Sundaragada":"Sundargarh",
    "Kendujhar":"Keonjhar","Kendrapada":"Kendrapara","Jagatsinghapur":"Jagatsinghpur",
    "Subarnapur":"Sonepur","Balangir":"Bolangir","Debagada":"Deogarh",
    "Shrawasti":"Shravasti","Purbi Champaran":"Purba Champaran","Kheri":"Lakhimpur Kheri",
    "Budaun":"Badaun","Mahrajganj":"Maharajganj","Kaimur":"Kaimur (Bhabua)",
    "Bhadohi":"Sant Ravi Das Nagar","Prayagraj":"Allahabad","Ayodhya":"Faizabad",
    "Sambhal":"Moradabad","Kasganj":"Etah","Hapur":"Ghaziabad",
    "Amroha":"Jyotiba Phule Nagar","Shamli":"Muzaffarnagar","Amethi":"Sultanpur",
    "Purulia":"Puruliya","Cooch Behar":"Kochbihar","Purba Bardhaman":"Barddhaman",
    "Paschim Bardhaman":"Barddhaman","Paschim Medinipur":"West Midnapore",
    "Purba Medinipur":"Medinipur","Hooghly":"Hugli","Howrah":"Haora",
    "Alipurduar":"Jalpaiguri","Jhargram":"Medinipur","Kalimpong":"Darjeeling",
    "Narsimhapur":"Narsinghpur","Khandwa":"East Nimar","Khargone":"West Nimar",
    "Singrauli":"Sidhi","Maihar":"Satna","Mauganj":"Rewa","Pandhurna":"Chhindwara",
    "Niwari":"Tikamgarh","Agar-Malwa":"Shajapur","Alirajpur":"Jhabua","Arwal":"Jahanabad",
    "Viluppuram":"Villupuram","Tiruchirappalli":"Tiruchchirappalli",
    "Thoothukkudi":"Thoothukudi","Pathanamthitta":"Pattanamtitta",
    "Tenkasi":"Tirunelveli Kattabo","Kallakurichi":"Villupuram","Ranipet":"Vellore",
    "Tirupathur":"Vellore","Chengalpattu":"Kancheepuram","Mayiladuthurai":"Nagapattinam",
    "Tiruppur":"Coimbatore","Ananthapuramu":"Anantapur","Y.S.R. Kadapa":"Cuddapah",
    "Sri Potti Sriramulu Nellore":"Nellore","Mahabubnagar":"Mahbubnagar",
    "Annamayya":"Cuddapah","Tirupati":"Chittoor","Bapatla":"Guntur",
    "Eluru":"West Godavari","Anakapalli":"Vishakhapatnam",
    "Alluri Sitharama Raju":"East Godavari","Parvathipuram Manyam":"Vizianagaram",
    "Kakinada":"East Godavari","Dr. B.R. Ambedkar Konaseema":"East Godavari",
    "Ntr":"Krishna","Sri Sathya Sai":"Anantapur","Nandyal":"Kurnool","Palnadu":"Guntur",
    "Ranga Reddy":"Rangareddi","Jagitial":"Karimnagar","Vikarabad":"Rangareddi",
    "Mahabubabad":"Warangal","Siddipet":"Medak","Rajanna Sircilla":"Karimnagar",
    "Yadadri Bhuvanagiri":"Nalgonda","Nagarkurnool":"Mahbubnagar","Narayanpet":"Mahbubnagar",
    "Sangareddy":"Medak","Jangoan":"Warangal","Wanaparthy":"Mahbubnagar",
    "Kamareddy":"Nizamabad","Hanumakonda":"Warangal","Medchal Malkajgiri":"Rangareddi",
    "Bhadradri Kothagudem":"Khammam","Peddapalli":"Karimnagar","Suryapet":"Nalgonda",
    "Nirmal":"Adilabad","Mulugu":"Warangal","Kumuram Bheem Asifabad":"Adilabad",
    "Jogulamba Gadwal":"Mahbubnagar","Jayashankar Bhupalapally":"Warangal","Mancherial":"Adilabad",
    "Dakshina Kannada":"Dakshin Kannad","Uttara Kannada":"Uttar Kannand",
    "Shivamogga":"Shimoga","Tumakuru":"Tumkur","Mysuru":"Mysore","Vijayapura":"Bijapur",
    "Chikkamagaluru":"Chikmagalur","Chamarajanagar":"Chamrajanagar","Kalaburagi":"Gulbarga",
    "Belagavi":"Belgaum","Ballari":"Bellary","Yadgir":"Gulbarga",
    "Bengaluru Urban":"Bangalore","Bengaluru South":"Bangalore","Bengaluru Rural":"Bangalore Rural",
    "Ahilyanagar":"Ahmadnagar","Chhatrapati Sambhajinagar":"Aurangabad",
    "Dharashiv":"Osmanabad","Buldhana":"Buldana","Beed":"Bid","Palghar":"Thane",
    "Gondia":"Gondiya",
    "Gir Somnath":"Junagadh","Morbi":"Rajkot","Arvalli":"Sabar Kantha",
    "Mahisagar":"Panch Mahals","Chhotaudepur":"Vadodara","Devbhumi Dwarka":"Jamnagar",
    "Botad":"Bhavnagar","Tapi":"Surat",
    "Ferozepur":"Firozpur","Fazilka":"Firozpur","Pathankot":"Gurdaspur",
    "S.A.S Nagar":"Rupnagar","Sri Muktsar Sahib":"Muktsar",
    "Shahid Bhagat Singh Nagar":"Nawan Shehar","Malerkotla":"Sangrur",
    "Tarn Taran":"Amritsar","Sonipat":"Sonepat","Charkhi Dadri":"Bhiwani",
    "Gurugram":"Gurgaon","Nuh":"Mewat","Palwal":"Faridabad",
    "Neem Ka Thana":"Sikar","Kekri":"Ajmer","Didwana-Kuchaman":"Nagaur",
    "Beawar":"Ajmer","Balotra":"Barmer","Salumbar":"Udaipur",
    "Kotputli-Behror":"Jaipur","Deeg":"Bharatpur","Shahpura":"Jaipur",
    "Anoopgarh":"Sriganganagar","Chittorgarh":"Chittaurgarh","Phalodi":"Jodhpur",
    "Dudu":"Jaipur","Sanchor":"Jalor",
    "West Singhbhum":"Pashchim Singhbhum","East Singhbum":"Purba Singhbhum",
    "Sahebganj":"Sahibganj","Khunti":"Ranchi","Ramgarh":"Hazaribag",
    "Kabeerdham":"Kawardha","Surajpur":"Korea","Balodabazar-Bhatapara":"Raipur",
    "Balod":"Durg","Gaurela-Pendra-Marwahi":"Bilaspur","Mungeli":"Bilaspur",
    "Kondagaon":"Bastar","Gariyaband":"Raipur","Bemetara":"Durg",
    "Sakti":"Janjgir-Champa","Manendragarh-Chirmiri-Bharatpur":"Korea",
    "Mohla-Manpur-Ambagarh Chouki":"Rajnandgaon",
    "Khairagarh-Chhuikhadan-Gandai":"Raj Nandgaon",
    "Narayanpur":"Bastar","Dakshin Bastar Dantewada":"Dantewada","Uttar Bastar Kanker":"Kanker",
    "Lahaul And Spiti":"Lahul and Spiti",
    "Sivasagar":"Sibsagar","Biswanath":"Sonitpur","Charaideo":"Sibsagar",
    "Udalguri":"Darrang","Chirang":"Bongaigaon","Tamulpur":"Nalbari",
    "Bajali":"Barpeta","Sribhumi":"Karimganj","Hojai":"Nagaon",
    "West Karbi Anglong":"Karbi Anglong","Majuli":"Jorhat","South Salmara Mancachar":"Dhubri",
    "Khowai":"West Tripura","Sepahijala":"West Tripura",
    "Unakoti":"North Tripura","Gomati":"South Tripura",
    "West Jaintia Hills":"Jaintia Hills","East Jaintia Hills":"Jaintia Hills",
    "North Garo Hills":"Garo Hills","South West Garo Hills":"Garo Hills",
    "Eastern West Khasi Hills":"West Khasi Hills","South West Khasi Hills":"West Khasi Hills",
    "Ramban":"Doda","Kishtwar":"Doda","Reasi":"Udhampur","Shopian":"Pulwama",
    "Kulgam":"Anantnag","Ganderbal":"Srinagar","Bandipora":"Baramulla",
    "Rajouri":"Rajauri","Poonch":"Punch","Leh Ladakh":"Ladakh (Leh)",
    "Pakyong":"East Sikkim","Gyalshing":"West Sikkim","Mangan":"North Sikkim","Gangtok":"East Sikkim",
    "Imphal East":"Imphal","Imphal West":"Imphal","Kamjong":"Ukhrul",
    "Kangpokpi":"Senapati","Tengnoupal":"Chandel","Kakching":"Thoubal",
    "Leparada":"East Siang","Lower Siang":"East Siang","Siang":"West Siang",
    "Namsai":"Lohit","Longding":"Tirap","Kra Daadi":"Kurung Kumey",
    "Kamle":"Papum Pare","Dibang Valley":"Upper Dibang Valley","Anjaw":"Lohit",
    "Tseminyu":"Kohima","Peren":"Kohima","Chumoukedima":"Kohima",
    "Noklak":"Tuensang","Kiphire":"Tuensang","Longleng":"Mokokchung","Shamator":"Tuensang",
    "Siaha":"Lunglei","Saitual":"Aizawl","Khawzawl":"Champhai","Hnahthial":"Lunglei",
    "South Andamans":"Andaman Islands","North And Middle Andaman":"Andaman Islands",
    "Nicobars":"Nicobar Islands","Lakshadweep District":"Kavaratti",
    "New Delhi":"Delhi","North East":"Delhi","North West":"Delhi",
    "Central":"Delhi","South East":"Delhi","South West":"Delhi",
  };

  // Normalize: lowercase, strip suffixes, remove non-alphanumerics
  const normalize = (str: string = '') =>
    str.toLowerCase().trim()
      .replace(/\s+district$/i, '').replace(/\s+city$/i, '')
      .replace(/\s+rural$/i, '').replace(/\s+urban$/i, '')
      .replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');

  // Build lookup: normalized canonical GeoJSON name → DistrictStats.
  // The alias table is applied when indexing so GeoJSON feature lookups find
  // the right data even for renamed/carved districts.
  const statsLookup = useMemo(() => {
    const map = new Map<string, DistrictStats>();
    districtData.forEach((d) => {
      const canonical = DISTRICT_ALIASES[d.district] ?? d.district;
      map.set(normalize(canonical), d);   // indexed by GeoJSON name
      map.set(normalize(d.district), d);  // also by raw DB name (direct hits)
    });
    return map;
  }, [districtData]);

  // Resolve a GeoJSON feature name → DistrictStats
  const findStats = (featureName: string = ''): DistrictStats | undefined => {
    const norm = normalize(featureName);
    if (statsLookup.has(norm)) return statsLookup.get(norm);
    for (const [k, v] of statsLookup.entries()) {
      if (k.length > 4 && (norm.includes(k) || k.includes(norm))) return v;
    }
    return undefined;
  };

  // Color mapping based on flagged count or risk
  const getColor = (stats?: DistrictStats) => {
    if (!stats || stats.totalCount === 0) return '#e2e8f0'; // slate-200 for zero data
    const count = stats.flaggedCount;
    if (count >= 5) return '#e11d48'; // rose-600
    if (count >= 3) return '#f43f5e'; // rose-500
    if (count >= 2) return '#f59e0b'; // amber-500
    if (count >= 1) return '#fbbf24'; // amber-400
    return '#10b981'; // emerald-500 (low risk)
  };

  const styleFeature = (feature: any) => {
    const distName = feature?.properties?.district || '';
    const stats = findStats(distName);
    const isSelected = selectedDistrict && normalize(selectedDistrict) === normalize(distName);

    return {
      fillColor: getColor(stats),
      weight: isSelected ? 2.5 : 0.8,
      opacity: 1,
      color: isSelected ? '#1e293b' : '#94a3b8',
      fillOpacity: isSelected ? 0.9 : 0.65,
    };
  };

  const onEachFeature = (feature: any, layer: L.Layer) => {
    const props = feature?.properties || {};
    const distName = props.district || 'Unknown District';
    const stateName = props.state || '';
    const stats = findStats(distName);

    const tooltipContent = `
      <div class="p-2 text-xs font-sans">
        <div class="font-bold text-slate-900">${distName}</div>
        <div class="text-[11px] text-slate-500 mb-1.5">${stateName}</div>
        <div class="space-y-0.5 border-t border-slate-200 pt-1 text-slate-700">
          <div>Total Works: <span class="font-semibold">${stats?.totalCount || 0}</span></div>
          <div>Flagged Works: <span class="font-bold text-rose-600">${stats?.flaggedCount || 0}</span></div>
          <div>Avg Risk: <span class="font-semibold">${stats ? stats.avgRisk.toFixed(1) : 'N/A'}</span></div>
        </div>
      </div>
    `;

    layer.bindTooltip(tooltipContent, { sticky: true, className: 'leaflet-custom-tooltip' });

    layer.on({
      click: () => {
        if (onSelectDistrict) {
          onSelectDistrict(distName);
        }
      },
      mouseover: (e) => {
        const target = e.target;
        target.setStyle({ weight: 2, color: '#1e3a8a', fillOpacity: 0.85 });
      },
      mouseout: (e) => {
        const target = e.target;
        target.setStyle(styleFeature(feature));
      },
    });
  };

  if (loading) {
    return (
      <div className="h-96 w-full flex items-center justify-center bg-slate-100 rounded-xl border border-slate-200 text-slate-500 text-sm">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading Geographic Heat Map...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[480px] w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      <MapContainer
        center={[22.5937, 78.9629]} // Center of India
        zoom={5}
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {geoJsonData && (
          <GeoJSON
            key={JSON.stringify(statsLookup.size) + (selectedDistrict || '')}
            data={geoJsonData}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>

      {/* Legend overlay */}
      <div className="absolute bottom-4 right-4 z-[400] bg-white/95 backdrop-blur-xs p-3 rounded-lg shadow-md border border-slate-200 text-xs">
        <div className="font-semibold text-slate-800 mb-2">District Anomaly Intensity</div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded bg-rose-600" />
            <span className="text-slate-600">5+ Flagged Works (Critical)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded bg-rose-500" />
            <span className="text-slate-600">3–4 Flagged Works</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded bg-amber-500" />
            <span className="text-slate-600">1–2 Flagged Works</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded bg-emerald-500" />
            <span className="text-slate-600">0 Flagged Works (Normal)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded bg-slate-300" />
            <span className="text-slate-500">No active work data</span>
          </div>
        </div>
      </div>
    </div>
  );
};
