'use strict';
(function() {
	const CAPJS_VERSION = "0.1.0",
		HCWPAX_SIGNATURE = "WPA",
		TCPDUMP_MAGIC  = 0xa1b2c3d4,
		TCPDUMP_CIGAM  = 0xd4c3b2a1,
		PCAPNG_MAGIC = 0x1A2B3C4D,
		PCAPNG_CIGAM = 0xD4C3B2A1,
		TCPDUMP_DECODE_LEN  = 65535,
		DLT_IEEE802_11   = 105,
		DLT_IEEE802_11_PRISM    = 119,
		DLT_IEEE802_11_RADIO    = 127,
		DLT_IEEE802_11_PPI_HDR  = 192,
		IEEE80211_FCTL_FTYPE         = 0x000c,
		IEEE80211_FCTL_STYPE         = 0x00f0,
		IEEE80211_FCTL_TODS          = 0x0100,
		IEEE80211_FCTL_FROMDS        = 0x0200,
		IEEE80211_FTYPE_MGMT         = 0x0000,
		IEEE80211_FTYPE_DATA         = 0x0008,
		IEEE80211_STYPE_ASSOC_REQ      = 0x0000,
		IEEE80211_STYPE_REASSOC_REQ    = 0x0020,
		IEEE80211_STYPE_PROBE_REQ      = 0x0040,
		IEEE80211_STYPE_PROBE_RESP     = 0x0050,
		IEEE80211_STYPE_BEACON         = 0x0080,
		IEEE80211_STYPE_QOS_DATA       = 0x0080,
		IEEE80211_LLC_DSAP               = 0xAA,
		IEEE80211_LLC_SSAP               = 0xAA,
		IEEE80211_LLC_CTRL               = 0x03,
		IEEE80211_DOT1X_AUTHENTICATION   = 0x8E88,
		WPA_KEY_INFO_TYPE_MASK = 7,
		WPA_KEY_INFO_INSTALL = 64,
		WPA_KEY_INFO_ACK = 128,
		WPA_KEY_INFO_SECURE = 512,
		MFIE_TYPE_SSID       = 0,
		BROADCAST_MAC = [255, 255, 255, 255, 255, 255],
		MAX_ESSID_LEN =  32,
		EAPOL_TTL = 1,
		AK_PSK = 2,
		AK_PSKSHA256 = 6,
		AK_SAFE = -1,
		EXC_PKT_NUM_1 = 1,
		EXC_PKT_NUM_2 = 2,
		EXC_PKT_NUM_3 = 3,
		EXC_PKT_NUM_4 = 4,
		MESSAGE_PAIR_M12E2 = 0,
		MESSAGE_PAIR_M14E4 = 1,
		MESSAGE_PAIR_M32E2 = 2,
		MESSAGE_PAIR_M32E3 = 3,
		MESSAGE_PAIR_M34E3 = 4,
		MESSAGE_PAIR_M34E4 = 5,
		MESSAGE_PAIR_APLESS = 0b00010000,
		MESSAGE_PAIR_LE		= 0b00100000,
		MESSAGE_PAIR_BE		= 0b01000000,
		MESSAGE_PAIR_NC 	= 0b10000000,
		SUITE_OUI = [0, 15, 172],
		ZEROED_PMKID = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
	const byteToHex = [];
	for (let n = 0; n <= 0xff; ++n)	{
		const hexOctet = n.toString(16).padStart(2, "0");
		byteToHex.push(hexOctet);
	}
	function hex(arrayBuffer) {
		const buff = new Uint8Array(arrayBuffer);
		const hexOctets = [];
		for (let i = 0; i < buff.length; ++i)
			hexOctets.push(byteToHex[buff[i]]);
		return hexOctets.join("");
	}
	function isNumber(n) {
		return !isNaN(parseFloat(n)) && !isNaN(n - 0)
	}
	function GetUint16(b) {
		return (b[0] | b[1] << 8) >>> 0
	}
	function GetUint32(b) {
		return (b[0] | b[1] << 8 | b[2] << 16 | b[3] << 24) >>> 0
	}
	function GetUint64(b) {
		return (BigInt(b[0]) | BigInt(b[1]) << BigInt(8) | BigInt(b[2]) << BigInt(16) | BigInt(b[3]) << BigInt(24) | BigInt(b[4]) << BigInt(32) | BigInt(b[5]) << BigInt(40) | BigInt(b[6]) << BigInt(48) | BigInt(b[7]) << BigInt(56))
	}
	function PutUint16(v) {
		return [(v & 0x00ff) >>> 0, (v & 0xff00) >>> 8]
	}
	function PutUint32(v) {
		return [(v & 0x000000ff) >>> 0, (v & 0x0000ff00) >>> 8, (v & 0x00ff0000) >>> 16, (v & 0xff000000) >>> 24]
	}
	function byte_swap_16(n) {
		return ((n & 0xff00) >>> 8 | ((n & 0x00ff) >>> 0) << 8) >>> 0
	}
	function byte_swap_32(n) {
		return ((n & 0xff000000) >>> 24 | (n & 0x00ff0000) >>> 8 | ((n & 0x0000ff00) >>> 0) << 8 | ((n & 0x000000ff) >>> 0) << 24) >>> 0
	}
	function byte_swap_64(n) {
		return ((n & BigInt(0xff00000000000000)) >> BigInt(56) | (n & BigInt(0x00ff000000000000)) >> BigInt(40) | (n & BigInt(0x0000ff0000000000)) >> BigInt(24) | (n & BigInt(0x000000ff00000000)) >> BigInt(8) | (n & BigInt(0x00000000ff000000)) <<  BigInt(8) | (n & BigInt(0x0000000000ff0000)) << BigInt(24) | (n & BigInt(0x000000000000ff00)) << BigInt(40) | (n & BigInt(0x00000000000000ff)) << BigInt(56))
	}
	function to_signed_32(n) {
		n = (n & 0xffffffff) >>> 0;
		return ((n ^ 0x80000000) >>> 0) - 0x80000000
	}
	class capjsdb {
		constructor() {
			this.essids = {};
			this.pmkids = {};
			this.excpkts = {};
			this.hcwpaxs = {};
		}
		essid_add(bssid, essid, essid_len) {
			if (this.essids.hasOwnProperty(bssid))
				return
			if (essid_len == 0)
				return
			this.essids[bssid] = {
				'bssid': bssid,
				'essid': essid,
				'essid_len': essid_len
			}
		}
		pmkid_add(mac_ap, mac_sta, pmkid, akm) {
			this.pmkids[[mac_ap,mac_sta]] = {
				'mac_ap': mac_ap,
				'mac_sta': mac_sta,
				'pmkid': pmkid,
				'akm': akm
			}
		}
		excpkt_add(excpkt_num, tv_sec, tv_usec, replay_counter, mac_ap, mac_sta, nonce, eapol_len, eapol, keyver, keymic) {
			if (nonce.toString() == Array(32).fill(0).toString())
				return
			let key = mac_ap;
			let subkey = mac_sta;
			let subsubkey;
			if (excpkt_num == EXC_PKT_NUM_1 || excpkt_num == EXC_PKT_NUM_3) {
				subsubkey = 'ap';
			} else {
				subsubkey = 'sta';
			}
			if (!this.excpkts.hasOwnProperty(key)) {
				this.excpkts[key] = {};
			}
			if (!this.excpkts[key].hasOwnProperty(subkey)) {
				this.excpkts[key][subkey] = {};
			}
			if (!this.excpkts[key][subkey].hasOwnProperty(subsubkey)) {
				this.excpkts[key][subkey][subsubkey] = [];
			}
			this.excpkts[key][subkey][subsubkey].push({
				'excpkt_num': excpkt_num,
				'tv_sec': tv_sec,
				'tv_usec': tv_usec,
				'replay_counter': replay_counter,
				'mac_ap': key,
				'mac_sta': subkey,
				'nonce': nonce,
				'eapol_len': eapol_len,
				'eapol': eapol,
				'keyver': keyver,
				'keymic': keymic
			});
		}
		hcwpaxs_add(signature, ftype, pmkid_or_mic, mac_ap, mac_sta, essid, anonce, eapol, message_pair) {
			let key;
			if (ftype == "01") {
				key = pmkid_or_mic;
				this.hcwpaxs[key] = {
					'signature': signature,
					'type': ftype,
					'pmkid_or_mic': hex(pmkid_or_mic),
					'mac_ap': hex(mac_ap),
					'mac_sta': hex(mac_sta),
					'essid': hex(essid),
					'anonce': '',
					'eapol': '',
					'message_pair': ''
				};
			} else if (ftype == "02") {
				key = [pmkid_or_mic, message_pair];
				this.hcwpaxs[key] = {
					'signature': signature,
					'type': ftype,
					'pmkid_or_mic': hex(pmkid_or_mic),
					'mac_ap': hex(mac_ap),
					'mac_sta': hex(mac_sta),
					'essid': hex(essid),
					'anonce': hex(anonce),
					'eapol': hex(eapol),
					'message_pair': message_pair.toString(16).padStart(2, 0)
				};
			}
		}
	}
	class capjs {
		constructor(bytes, format, best_only, export_unauthenticated, ignore_ts, ignore_ie) {
			this.bytes = new Uint8Array(bytes); // bytes must be an ArrayBuffer
			this.format = format;
			this.best_only = best_only;
			this.export_unauthenticated = export_unauthenticated;
			this.ignore_ts = ignore_ts;
			this.ignore_ie = ignore_ie;
			this.pos = 0; // read cursor position
			this.db = new capjsdb(); // database
		}
		Analysis() {
			if ((this.format == "pcap") || (this.format == "cap")) {
				this._pcap2hcwpax();
			} else if (this.format == "pcapng") {
				this._pcapng2hcwpax();
			} else {
				this._Log('Unsupported capture file');
			}
		}
		Get(x) {
			if (x == 'hcwpax') {
				return this.db.hcwpaxs;
			}
			return;
		}
		Getf(x) {
			let data = '';
			if (x == 'hcwpax') {
				Object.values(this.db.hcwpaxs).forEach(function(hcwpax) {
					data += (Object.values(hcwpax).join('*'));
					data += '\n';
				});
			}
			return data;
		}
		_Log(msg) {
			console.log(msg);
		}
		__Read(n) {
			let data = this.bytes.slice(this.pos, this.pos+n);
			this.pos += n;
			return data;
		}
		__get_essid_from_tag(packet, header, length_skip) {
			if (length_skip > header['caplen'])
				return [-1, NaN];
			let length = header['caplen'] - length_skip;
			let beacon = packet.slice(length_skip, length_skip+length);
			let cur = 0;
			let end = beacon.length;
			var tagtype, taglen;
			while (cur < end) {
				if ((cur + 2) >= end)
					break
				tagtype = beacon[cur];
				cur += 1;
				taglen  = beacon[cur];
				cur += 1;
				if ((cur + taglen) >= end)
					break
				if (tagtype == MFIE_TYPE_SSID) {
					if (taglen <= MAX_ESSID_LEN) {
						let essid = {};
						essid['essid'] = new Uint8Array(MAX_ESSID_LEN);
						essid['essid'].set(beacon.slice(cur, cur+taglen));
						essid['essid_len'] = taglen;
						return [0, essid];
					}
				}
				cur += taglen;
			}
			return [-1, NaN];
		}
		__get_pmkid_from_packet(packet, source) {
			var i, pos, skip, tag_id, tag_len, tag_data, tag_pairwise_suite_count, tag_authentication_suite_count, pmkid_count, akm;
			if (source == "EAPOL-M1") {
				akm = NaN; // Unknown AKM
				pos = 0;
				while (true) {
					tag_id = packet[pos];
					if (tag_id == undefined)
						break;
					tag_len = packet[pos+1];
					if (tag_id == 221) {
						tag_data = packet.slice(pos+2, pos+2+tag_len);
						if (tag_data.slice(0, 3).toString() == SUITE_OUI.toString()) {
							let pmkid = tag_data.slice(4);
							if (pmkid.toString() != ZEROED_PMKID.toString())
								return [pmkid, akm];
						}
					}
					break;
					pos = pos+2+tag_len;
				}
				return;
			} else if (source == "EAPOL-M2") {
				pos = 0;
			} else if (source == IEEE80211_STYPE_ASSOC_REQ) {
				pos = 28;
			} else if (source == IEEE80211_STYPE_REASSOC_REQ) {
				pos = 34;
			} else {
				return;
			}
			while (true) {
				tag_id = packet[pos];
				if (tag_id == undefined)
					break;
				tag_len = packet[pos+1];
				if (tag_id == 48) {
					tag_data = packet.slice(pos+2, pos+2+tag_len);
					tag_pairwise_suite_count = GetUint16(tag_data.slice(6, 8));
					pos = 8;
					pos += 4*tag_pairwise_suite_count;
					// AKM Suite
					tag_authentication_suite_count = GetUint16(tag_data.slice(pos, pos+2));
					pos = pos+2;
					skip = 0;
					for (i=0; i<tag_authentication_suite_count; i++) {
						pos += (4*i)+4;
						akm = tag_data.slice(pos-4, pos);
						if (akm.slice(0, 3).toString() != SUITE_OUI.toString()) {
							skip = 1;
							break;
						}
					}
					if (skip == 1)
						break
					pmkid_count = GetUint16(tag_data.slice(pos+2, pos+4));
					pos = pos+4;
					for (i=0; i<pmkid_count; i++) {
						pos += (16*i)+16;
						let pmkid = tag_data.slice(pos-16, pos);
						if (pmkid.toString() != ZEROED_PMKID.toString())
							return [pmkid, akm[3]];
					}
					break;
				}
				pos = pos+2+tag_len;
			}
		}
		__handle_llc(ieee80211_llc_snap_header) {
			if (ieee80211_llc_snap_header['dsap'] != IEEE80211_LLC_DSAP)
				return -1
			if (ieee80211_llc_snap_header['ssap'] != IEEE80211_LLC_SSAP)
				return -1
			if (ieee80211_llc_snap_header['ctrl'] != IEEE80211_LLC_CTRL)
				return -1
			if (ieee80211_llc_snap_header['ethertype'] != IEEE80211_DOT1X_AUTHENTICATION)
				return -1
			return 0
		}
		__handle_auth(auth_packet, auth_packet_copy, auth_packet_t_size, keymic_size, rest_packet, pkt_offset, pkt_size) {
			let ap_length               = byte_swap_16(auth_packet['length']);
			let ap_key_information      = byte_swap_16(auth_packet['key_information']);
			let ap_replay_counter       = byte_swap_64(auth_packet['replay_counter']);
			let ap_wpa_key_data_length  = byte_swap_16(auth_packet['wpa_key_data_length']);
			if (ap_length == 0)
				return [-1, NaN];
			var excpkt_num;
			if ((ap_key_information & WPA_KEY_INFO_ACK) >>> 0) {
				if ((ap_key_information & WPA_KEY_INFO_INSTALL) >>> 0) {
					excpkt_num = EXC_PKT_NUM_3;
				} else {
					excpkt_num = EXC_PKT_NUM_1;
				}
			} else {
				if ((ap_key_information & WPA_KEY_INFO_SECURE) >>> 0) {
					excpkt_num = EXC_PKT_NUM_4;
				} else {
					excpkt_num = EXC_PKT_NUM_2;
				}
			}
			let excpkt = {};
			excpkt['nonce'] = new Uint8Array(32);
			excpkt['nonce'].set(auth_packet['wpa_key_nonce']);
			excpkt['replay_counter'] = ap_replay_counter;
			excpkt['excpkt_num'] = excpkt_num;
			excpkt['eapol_len'] = auth_packet_t_size + ap_wpa_key_data_length;
			if ((pkt_offset + excpkt['eapol_len']) > pkt_size)
				return [-1, NaN];
			if ((auth_packet_t_size + ap_wpa_key_data_length) > 256)
				return [-1, NaN];
			excpkt['eapol'] = new Uint8Array(256);
			excpkt['eapol'].set(auth_packet_copy);
			excpkt['eapol'].set(rest_packet.slice(0, ap_wpa_key_data_length), auth_packet_t_size);
			excpkt['keymic'] = auth_packet['wpa_key_mic'];
			excpkt['keyver'] = (ap_key_information & WPA_KEY_INFO_TYPE_MASK) >>> 0;
			if ((excpkt_num == EXC_PKT_NUM_3) || (excpkt_num == EXC_PKT_NUM_4))
				excpkt['replay_counter'] -= BigInt(1);
			return [0, excpkt];
		}
		__process_packet(packet, header) {
			if (header['caplen'] < 24)
				return
			let ieee80211_hdr_3addr = {
				'frame_control': GetUint16(packet.slice(0, 2)),
				//duration_id
				'addr1': [packet[4], packet[5], packet[6], packet[7], packet[8], packet[9]],
				'addr2': [packet[10], packet[11], packet[12], packet[13], packet[14], packet[15]],
				'addr3': [packet[16], packet[17], packet[18], packet[19], packet[20], packet[21]]
				//seq_ctrl
			}
			if (ieee80211_hdr_3addr['addr3'] == BROADCAST_MAC)
				return
			let frame_control = ieee80211_hdr_3addr['frame_control'];
			if ((frame_control & IEEE80211_FCTL_FTYPE) >>> 0 == IEEE80211_FTYPE_MGMT) {
				var rc_beacon, essid;
				let stype = (frame_control & IEEE80211_FCTL_STYPE) >>> 0;
				if (stype == IEEE80211_STYPE_BEACON) {
					[rc_beacon, essid] = this.__get_essid_from_tag(packet, header, 36);
					if (rc_beacon == -1)
						return
					this.db.essid_add(ieee80211_hdr_3addr['addr3'], essid['essid'], essid['essid_len']);
				} else if (stype == IEEE80211_STYPE_PROBE_REQ) {
					[rc_beacon, essid] = this.__get_essid_from_tag(packet, header, 24);
					if (rc_beacon == -1)
						return
					this.db.essid_add(ieee80211_hdr_3addr['addr3'], essid['essid'], essid['essid_len']);
				} else if (stype == IEEE80211_STYPE_PROBE_RESP) {
					[rc_beacon, essid] = this.__get_essid_from_tag(packet, header, 36);
					if (rc_beacon == -1)
						return
					this.db.essid_add(ieee80211_hdr_3addr['addr3'], essid['essid'], essid['essid_len']);
				} else if (stype == IEEE80211_STYPE_ASSOC_REQ) {
					[rc_beacon, essid] = this.__get_essid_from_tag(packet, header, 28);
					if (rc_beacon == -1)
						return
					this.db.essid_add(ieee80211_hdr_3addr['addr3'], essid['essid'], essid['essid_len']);
					let mac_ap = ieee80211_hdr_3addr['addr3'];
					let mac_sta = (mac_ap == ieee80211_hdr_3addr['addr1']) ? ieee80211_hdr_3addr['addr2'] : ieee80211_hdr_3addr['addr1'];
					let pmkid_akm = this.__get_pmkid_from_packet(packet, stype);
					if (pmkid_akm != undefined)
						this.db.pmkid_add(mac_ap, mac_sta, pmkid_akm[0], pmkid_akm[1]);
				} else if (stype == IEEE80211_STYPE_REASSOC_REQ) {
					[rc_beacon, essid] = this.__get_essid_from_tag(packet, header, 34);
					if (rc_beacon == -1)
						return
					this.db.essid_add(ieee80211_hdr_3addr['addr3'], essid['essid'], essid['essid_len']);
					let mac_ap = ieee80211_hdr_3addr['addr3'];
					let mac_sta = (mac_ap == ieee80211_hdr_3addr['addr1']) ? ieee80211_hdr_3addr['addr2'] : ieee80211_hdr_3addr['addr1'];
					let pmkid_akm = this.__get_pmkid_from_packet(packet, stype);
					if (pmkid_akm != undefined)
						this.db.pmkid_add(mac_ap, mac_sta, pmkid_akm[0], pmkid_akm[1]);
				}
			} else if ((frame_control & IEEE80211_FCTL_FTYPE) >>> 0 == IEEE80211_FTYPE_DATA) {
				var llc_offset;
				let addr4_exist = ((frame_control & (IEEE80211_FCTL_TODS | IEEE80211_FCTL_FROMDS)>>>0)>>>0 == (IEEE80211_FCTL_TODS | IEEE80211_FCTL_FROMDS)>>>0);
				if ((frame_control & IEEE80211_FCTL_STYPE)>>>0 == IEEE80211_STYPE_QOS_DATA) {
					llc_offset = 26;
				} else {
					llc_offset = 24;
				}
				if (header['caplen'] < (llc_offset + 8))
					return;
				if (addr4_exist)
					llc_offset += 6
				let ieee80211_llc_snap_header = {
					'dsap': packet[llc_offset],
					'ssap': packet[llc_offset+1],
					'ctrl': packet[llc_offset+2],
					//'oui': (packet[llc_offset+3], packet[llc_offset+4], packet[llc_offset+5]),
					'ethertype': GetUint16(packet.slice(llc_offset+6,llc_offset+8))
				}
				let rc_llc = this.__handle_llc(ieee80211_llc_snap_header);
				if (rc_llc == -1)
					return
				let auth_offset = llc_offset + 8;
				let auth_head_type = packet[auth_offset+1];
				let auth_head_length = GetUint16(packet.slice(auth_offset+2, auth_offset+4));
				var keymic_size, auth_packet_t_size;
				if (auth_head_type == 3) {
					if (packet.slice(auth_offset).length < 107) {
						keymic_size = 16;
						auth_packet_t_size = 99;
					} else {
						let l1 = GetUint16(packet.slice(auth_offset+97, auth_offset+99));
						let l2 = GetUint16(packet.slice(auth_offset+105, auth_offset+107));
						auth_head_length = byte_swap_16(auth_head_length);
						l1 = byte_swap_16(l1);
						l2 = byte_swap_16(l2);
						if (l1 + 99 == auth_head_length+4) {
							keymic_size = 16;
							auth_packet_t_size = 99;
						} else if (l2 + 107 == auth_head_length+4) {
							keymic_size = 24;
							auth_packet_t_size = 107;
						} else {
							return;
						}
					}
					if (header['caplen'] < (auth_offset + auth_packet_t_size))
						return
					var auth_packet, auth_packet_copy;
					if (keymic_size == 16) {
						auth_packet = {
							'length': GetUint16(packet.slice(auth_offset+2, auth_offset+4)),
							'key_information': GetUint16(packet.slice(auth_offset+5, auth_offset+7)),
							'replay_counter': GetUint64(packet.slice(auth_offset+9, auth_offset+17)),
							'wpa_key_nonce': packet.slice(auth_offset+17, auth_offset+49),
							'wpa_key_mic': packet.slice(auth_offset+81, auth_offset+97),
							'wpa_key_data_length': GetUint16(packet.slice(auth_offset+97, auth_offset+99))
						}
						auth_packet_copy = new Uint8Array(auth_packet_t_size);
						auth_packet_copy.set(packet.slice(auth_offset, auth_offset+81));
						auth_packet_copy.set([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 81);
						auth_packet_copy.set((packet.slice(auth_offset+97, auth_offset+99)), 97);
					} else if (keymic_size == 24) {
						auth_packet = {
							'length': GetUint16(packet.slice(auth_offset+2, auth_offset+4)),
							'key_information': GetUint16(packet.slice(auth_offset+5, auth_offset+7)),
							'replay_counter': GetUint64(packet.slice(auth_offset+9, auth_offset+17)),
							'wpa_key_nonce': packet.slice(auth_offset+17, auth_offset+49),
							'wpa_key_mic': packet.slice(auth_offset+81, auth_offset+105),
							'wpa_key_data_length': GetUint16(packet.slice(auth_offset+105, auth_offset+107))
						}
						auth_packet_copy = new Uint8Array(auth_packet_t_size);
						auth_packet_copy.set(packet.slice(auth_offset, auth_offset+81));
						auth_packet_copy.set([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 81);
						auth_packet_copy.set((packet.slice(auth_offset+105, auth_offset+107)), 105);
					} else {
						return;
					}
					let rest_packet = packet.slice(auth_offset+auth_packet_t_size);
					var rc_auth, excpkt;
					[rc_auth, excpkt] = this.__handle_auth(auth_packet, auth_packet_copy, auth_packet_t_size, keymic_size, rest_packet, auth_offset, header['caplen']);
					if (rc_auth == -1)
						return;
					if (excpkt['excpkt_num'] == EXC_PKT_NUM_1 || excpkt['excpkt_num'] == EXC_PKT_NUM_3) {
						this.db.excpkt_add(excpkt['excpkt_num'], header['tv_sec'], header['tv_usec'], excpkt['replay_counter'], ieee80211_hdr_3addr['addr2'], ieee80211_hdr_3addr['addr1'], excpkt['nonce'], excpkt['eapol_len'], excpkt['eapol'], excpkt['keyver'], excpkt['keymic']);
						if (excpkt['excpkt_num'] == EXC_PKT_NUM_1) {
							let pmkid_akm = this.__get_pmkid_from_packet(rest_packet, "EAPOL-M1");
							if (pmkid_akm != undefined) {
								if (isNaN(pmkid_akm[1]) && excpkt['keyver'] >= 1 && excpkt['keyver'] <= 3)
									pmkid_akm[1] = AK_SAFE;
								this.db.pmkid_add(ieee80211_hdr_3addr['addr2'], ieee80211_hdr_3addr['addr1'], pmkid_akm[0], pmkid_akm[1]);
							}
						}
					} else if (excpkt['excpkt_num'] == EXC_PKT_NUM_2 || excpkt['excpkt_num'] == EXC_PKT_NUM_4) {
						this.db.excpkt_add(excpkt['excpkt_num'], header['tv_sec'], header['tv_usec'], excpkt['replay_counter'], ieee80211_hdr_3addr['addr1'], ieee80211_hdr_3addr['addr2'], excpkt['nonce'], excpkt['eapol_len'], excpkt['eapol'], excpkt['keyver'], excpkt['keymic']);
						if (excpkt['excpkt_num'] == EXC_PKT_NUM_2) {
							let pmkid_akm = this.__get_pmkid_from_packet(rest_packet, "EAPOL-M2");
							if (pmkid_akm != undefined) {
								if (isNaN(pmkid_akm[1]) && excpkt['keyver'] >= 1 && excpkt['keyver'] <= 3)
									pmkid_akm[1] = AK_SAFE;
								this.db.pmkid_add(ieee80211_hdr_3addr['addr1'], ieee80211_hdr_3addr['addr2'], pmkid_akm[0], pmkid_akm[1]);
							}
						}
					}
				}
			}
		}
		__read_pcap_file_header() {
			let pcap_header = this.__Read(24);
			if (!pcap_header.length)
				return;
			let pcap_file_header = {
				'magic': GetUint32(pcap_header.slice(0, 4)),
				//version_major
				//version_minor
				//thiszone
				//sigfigs
				//snaplen
				'linktype': GetUint32(pcap_header.slice(20, 24))
			};
			var bitness;
			if (pcap_file_header['magic'] == TCPDUMP_MAGIC) {
				bitness = 0;
			} else if (pcap_file_header['magic'] == TCPDUMP_CIGAM) {
				bitness = 1;
				pcap_file_header['linktype'] = byte_swap_32(pcap_file_header['linktype']);
			} else {
				this._Log('Invalid pcap header');
				return;
			}
			if ((pcap_file_header['linktype'] != DLT_IEEE802_11) && (pcap_file_header['linktype'] != DLT_IEEE802_11_PRISM) && (pcap_file_header['linktype'] != DLT_IEEE802_11_RADIO) && (pcap_file_header['linktype'] != DLT_IEEE802_11_PPI_HDR)) {
				this._Log('Unsupported linktype detected');
				return;
			}
			return [pcap_file_header, bitness];
		}
		__read_pcap_packets(pcap_file_header, bitness) {
			while (true) {
				let pcap_pkthdr = this.__Read(16);
				if (!pcap_pkthdr.length)
					break;
				let header = {
					'tv_sec': GetUint32(pcap_pkthdr.slice(0, 4)),
					'tv_usec': GetUint32(pcap_pkthdr.slice(4, 8)),
					'caplen': GetUint32(pcap_pkthdr.slice(8, 12)),
					'len': GetUint32(pcap_pkthdr.slice(12, 16))
				}
				if (bitness) {
					header['tv_sec']   = byte_swap_32(header['tv_sec']);
					header['tv_usec']  = byte_swap_32(header['tv_usec']);
					header['caplen']   = byte_swap_32(header['caplen']);
					header['len']      = byte_swap_32(header['len']);
				}
				if (header['tv_sec'] == 0 && header['tv_usec'] == 0) {
					this._Log('Zero value timestamps detected');
					if (!this.ignore_ts)
						continue;
				}
				if (header['caplen'] >= TCPDUMP_DECODE_LEN || to_signed_32(header['caplen']) < 0) {
					this._Log('Oversized packet detected');
					continue;
				}
				let packet = this.__Read(header['caplen']);
				if (pcap_file_header['linktype'] == DLT_IEEE802_11_PRISM) {
					if (header['caplen'] < 144) {
						this._Log('Could not read prism header');
						continue;
					}
					let prism_header = {
						'msgcode': GetUint32(packet.slice(0, 4)),
						'msglen': GetUint32(packet.slice(4, 8))
						//devname
						//hosttime
						//mactime
						//channel
						//rssi
						//sq
						//signal
						//noise
						//rate
						//istx
						//frmlen
					}
					if (to_signed_32(prism_header['msglen']) < 0) {
						this._Log('Oversized packet detected');
						continue;
					}
					if (to_signed_32(header['caplen'] - prism_header['msglen']) < 0) {
						this._Log('Oversized packet detected');
						continue;
					}
					packet = packet.slice(prism_header['msglen']);
					header['caplen'] -= prism_header['msglen'];
					header['len']    -= prism_header['msglen'];
				} else if (pcap_file_header['linktype'] == DLT_IEEE802_11_RADIO) {
					if (header['caplen'] < 8) {
						this._Log('Could not read radiotap header');
						continue;
					}
					let ieee80211_radiotap_header = {
						'it_version': packet[0],
						//it_pad
						'it_len': GetUint16(packet.slice(2, 4)),
						'it_present': GetUint32(packet.slice(4, 8))
					}
					if (ieee80211_radiotap_header['it_version'] != 0) {
						this._Log('Invalid radiotap header');
						continue;
					}
					packet = packet.slice(ieee80211_radiotap_header['it_len']);
					header['caplen'] -= ieee80211_radiotap_header['it_len'];
					header['len']    -= ieee80211_radiotap_header['it_len'];
				} else if (pcap_file_header['linktype'] == DLT_IEEE802_11_PPI_HDR) {
					if (header['caplen'] < 8) {
						this._Log('Could not read ppi header');
						continue;
					}
					let ppi_packet_header = {
						//pph_version
						//pph_flags
						'pph_len': GetUint16(packet.slice(2, 4))
						//pph_dlt
					}
					packet = packet.slice(ppi_packet_header['pph_len']);
					header['caplen'] -= ppi_packet_header['pph_len'];
					header['len']    -= ppi_packet_header['pph_len'];
				}
				this.__process_packet(packet, header);
			}
		}
		__build() {
			var tmp_tobeadded;
			if (Object.keys(this.db.essids).length === 0) {
				this._Log('No Networks found');
				return;
			}
			for (var essid_key in this.db.essids) {
				var essid = this.db.essids[essid_key];
				tmp_tobeadded = {};
				let excpkts_AP_ = this.db.excpkts[essid['bssid']];
				if (!excpkts_AP_)
					continue;
				for (var excpkts_AP_STA_key in excpkts_AP_) {
					var excpkts_AP_STA_ = excpkts_AP_[excpkts_AP_STA_key];
					let excpkts_AP_STA_ap = excpkts_AP_STA_['ap'];
					if (!excpkts_AP_STA_ap)
						continue;
					for (var excpkt_ap_key in excpkts_AP_STA_ap) {
						var excpkt_ap = excpkts_AP_STA_ap[excpkt_ap_key];
						let excpkts_AP_STA_sta = excpkts_AP_STA_['sta'];
						if (!excpkts_AP_STA_sta)
							continue;
						for (var excpkt_sta_key in excpkts_AP_STA_sta) {
							var excpkt_sta = excpkts_AP_STA_sta[excpkt_sta_key];
							if (excpkt_ap['replay_counter'] != excpkt_sta['replay_counter'])
								continue
							if (excpkt_ap['excpkt_num'] < excpkt_sta['excpkt_num']) {
								if (excpkt_ap['tv_sec'] > excpkt_sta['tv_sec'])
									continue;
								if ((excpkt_ap['tv_sec'] + EAPOL_TTL) < excpkt_sta['tv_sec'])
									continue;
							} else {
								if (excpkt_sta['tv_sec'] > excpkt_ap['tv_sec'])
									continue;
								if ((excpkt_sta['tv_sec'] + EAPOL_TTL) < excpkt_ap['tv_sec'])
									continue;
							}
							let message_pair = 255;
							if ((excpkt_ap['excpkt_num'] == EXC_PKT_NUM_1) && (excpkt_sta['excpkt_num'] == EXC_PKT_NUM_2)) {
								if (excpkt_sta['eapol_len'] > 0) {
									message_pair = MESSAGE_PAIR_M12E2;
								} else {
									continue;
								}
							} else if ((excpkt_ap['excpkt_num'] == EXC_PKT_NUM_1) && (excpkt_sta['excpkt_num'] == EXC_PKT_NUM_4)) {
								if (excpkt_sta['eapol_len'] > 0) {
									message_pair = MESSAGE_PAIR_M14E4;
								} else {
									continue;
								}
							} else if ((excpkt_ap['excpkt_num'] == EXC_PKT_NUM_3) && (excpkt_sta['excpkt_num'] == EXC_PKT_NUM_2)) {
								if (excpkt_sta['eapol_len'] > 0) {
									message_pair = MESSAGE_PAIR_M32E2;
								} else if (excpkt_ap['eapol_len'] > 0) {
									message_pair = MESSAGE_PAIR_M32E3;
								} else {
									continue;
								}
							} else if ((excpkt_ap['excpkt_num'] == EXC_PKT_NUM_3) && (excpkt_sta['excpkt_num'] == EXC_PKT_NUM_4)) {
								if (excpkt_ap['eapol_len'] > 0) {
									message_pair = MESSAGE_PAIR_M34E3;
								} else if (excpkt_sta['eapol_len'] > 0) {
									message_pair = MESSAGE_PAIR_M34E4;
								} else {
									continue;
								}
							} else {
								this._Log('BUG AP:'+excpkt_ap['excpkt_num']+' STA:'+excpkt_ap['excpkt_num']);
							}
							let auth = 1;
							let ap_less = 0;
							if (message_pair == MESSAGE_PAIR_M32E3 || message_pair == MESSAGE_PAIR_M34E3)
								continue;
							if (message_pair == MESSAGE_PAIR_M12E2) {
								auth = 0;
								/* HCXDUMPTOOL (AP-LESS) */
								/* ..................... */
							}
							/* LE/BE/NC */
							for (var excpkt_ap_k_key in excpkts_AP_STA_ap) {
								var excpkt_ap_k = excpkts_AP_STA_ap[excpkt_ap_k_key];
								if ((excpkt_ap['nonce'].slice(0, 28).toString() == excpkt_ap_k['nonce'].slice(0, 28).toString()) && (excpkt_ap['nonce'].slice(28).toString() != excpkt_ap_k['nonce'].slice(28).toString())) {
									if ((message_pair & MESSAGE_PAIR_NC) >>> 0 != MESSAGE_PAIR_NC)
										message_pair = (message_pair | MESSAGE_PAIR_NC) >>> 0;
									if (excpkt_ap['nonce'][31] != excpkt_ap_k['nonce'][31]) {
										if ((message_pair & MESSAGE_PAIR_LE) >>> 0 != MESSAGE_PAIR_LE)
											message_pair = (message_pair | MESSAGE_PAIR_LE) >>> 0;
									} else if (excpkt_ap['nonce'][28] != excpkt_ap_k['nonce'][28]) {
										if ((message_pair & MESSAGE_PAIR_BE) >>> 0 != MESSAGE_PAIR_BE)
											message_pair = (message_pair | MESSAGE_PAIR_BE) >>> 0;
									}
								}
							}
							for (var excpkt_sta_k_key in excpkts_AP_STA_sta) {
								var excpkt_sta_k = excpkts_AP_STA_sta[excpkt_sta_k_key];
								if ((excpkt_sta['nonce'].slice(0, 28).toString() == excpkt_sta_k['nonce'].slice(0, 28).toString()) && (excpkt_sta['nonce'].slice(28).toString() != excpkt_sta_k['nonce'].slice(28).toString())) {
									if ((message_pair & MESSAGE_PAIR_NC) >>> 0 != MESSAGE_PAIR_NC)
										message_pair = (message_pair | MESSAGE_PAIR_NC) >>> 0;
									if (excpkt_sta['nonce'][31] != excpkt_sta_k['nonce'][31]) {
										if ((message_pair & MESSAGE_PAIR_LE) >>> 0 != MESSAGE_PAIR_LE)
											message_pair = (message_pair | MESSAGE_PAIR_LE) >>> 0;
									} else if (excpkt_sta['nonce'][28] != excpkt_sta_k['nonce'][28]) {
										if ((message_pair & MESSAGE_PAIR_BE) >>> 0 != MESSAGE_PAIR_BE)
											message_pair = (message_pair | MESSAGE_PAIR_BE) >>> 0;
									}
								}
							}
							if (auth == 0) {
								if (!this.export_unauthenticated)
									continue;
							}
							let data = {}
							data['message_pair'] = message_pair;
							data['essid_len'] = essid['essid_len'];
							data['essid'] = essid['essid'];
							data['mac_ap'] = excpkt_ap['mac_ap'];
							data['nonce_ap'] = excpkt_ap['nonce'];
							data['mac_sta'] = excpkt_sta['mac_sta'];
							data['nonce_sta'] = excpkt_sta['nonce'];
							if (excpkt_sta['eapol_len'] > 0) {
								data['keyver'] = excpkt_sta['keyver'];
								data['keymic'] = excpkt_sta['keymic'];
								data['eapol_len'] = excpkt_sta['eapol_len'];
								data['eapol'] = excpkt_sta['eapol'];
							} else {
								data['keyver'] = excpkt_ap['keyver'];
								data['keymic'] = excpkt_ap['keymic'];
								data['eapol_len'] = excpkt_ap['eapol_len'];
								data['eapol'] = excpkt_ap['eapol'];
							}
							tmp_tobeadded[Math.abs(excpkt_ap['tv_usec'] - excpkt_sta['tv_usec'])] = [HCWPAX_SIGNATURE, "02", data['keymic'], data['mac_ap'], data['mac_sta'], data['essid'].slice(0, data['essid_len']), data['nonce_ap'], data['eapol'].slice(0, data['eapol_len']), data['message_pair']];
						}
					}
				}
				for (var pmkdid_key in this.db.pmkids) {
					let pmkid = this.db.pmkids[pmkdid_key];
					if (pmkid['mac_ap'].toString() == essid['bssid'].toString()) {
						if (this.ignore_ie === true || [AK_PSK, AK_PSKSHA256, AK_SAFE].includes(pmkid['akm'])) {
							tmp_tobeadded[0] = [HCWPAX_SIGNATURE, "01", pmkid['pmkid'], pmkid['mac_ap'], pmkid['mac_sta'], essid['essid'].slice(0, essid['essid_len']), '', '', ''];
						}
					}
				}
				let tmp_tobeadded_length = Object.keys(tmp_tobeadded).length;
				if (tmp_tobeadded_length === 0) {
					this._Log(hex(essid['bssid'])+': No eligible hs/pmkid found');
					continue;
				} else {
					this._Log(hex(essid['bssid'])+': '+tmp_tobeadded_length+' eligible hs/pmkid found');
					if (this.best_only === true) {
						let hcwpax = tmp_tobeadded[Math.min(...Object.keys(tmp_tobeadded))];
						this.db.hcwpaxs_add(hcwpax[0], hcwpax[1], hcwpax[2], hcwpax[3], hcwpax[4], hcwpax[5], hcwpax[6], hcwpax[7], hcwpax[8]);
					} else {
						Object.values(tmp_tobeadded).forEach(function(hcwpax) {
							this.db.hcwpaxs_add(hcwpax[0], hcwpax[1], hcwpax[2], hcwpax[3], hcwpax[4], hcwpax[5], hcwpax[6], hcwpax[7], hcwpax[8]);
						}, this);
					}
				}
			}
		}
		_pcap2hcwpax() {
			var pcap_file_header, bitness;
			let read_pcap_file_header = this.__read_pcap_file_header();
			if (read_pcap_file_header == undefined) {
				this._Log('Could not read pcap header');
				return;
			}
			[pcap_file_header, bitness] = read_pcap_file_header;
			this.__read_pcap_packets(pcap_file_header, bitness);
			this.__build();
		}
		_pcapng2hcwpax() {
			this._Log('PCAPNG files are not currently supported.');
		}
	}
	// Export capjs
	window.capJS = capjs;
	window.capJS.version = CAPJS_VERSION;
})();