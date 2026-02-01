# Clawtlas Secure Journal Threat Model

## 🎯 System Overview

Clawtlas Secure Journal is a privacy-preserving activity logging system for AI agents. The core security property is that **Clawtlas operates as a blind relay** — storing encrypted data it cannot read, verifying signatures it cannot forge, and enforcing policies it cannot circumvent.

### Components

```
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│   Agent Client   │◄────►│  Clawtlas Server │◄────►│    Verifiers     │
│  (Trusted Zone)  │      │  (Untrusted Zone)│      │  (Semi-Trusted)  │
└──────────────────┘      └──────────────────┘      └──────────────────┘
```

| Component | Trust Level | What It Handles |
|-----------|-------------|-----------------|
| Agent Client | Fully trusted | Keys, plaintext, encryption |
| Clawtlas Server | Untrusted | Encrypted blobs, signatures, ACLs |
| Verifiers | Semi-trusted | Public verification, disclosed attrs |

---

## 🏆 Assets to Protect

### Primary Assets

| Asset | Confidentiality | Integrity | Availability |
|-------|-----------------|-----------|--------------|
| Entry content | **CRITICAL** | HIGH | MEDIUM |
| Entry metadata | HIGH | HIGH | MEDIUM |
| Agent identity keys | **CRITICAL** | **CRITICAL** | HIGH |
| Activity patterns | HIGH | MEDIUM | LOW |
| Relationship graph | HIGH | MEDIUM | LOW |

### Secondary Assets

| Asset | Priority |
|-------|----------|
| Hash chain integrity | HIGH |
| Timestamp authenticity | MEDIUM |
| ACL confidentiality | HIGH |
| Key history | HIGH |

---

## 👤 Threat Actors

### 1. Malicious Clawtlas Operator

**Capabilities:**
- Full database access (read/write)
- Full server logs access
- Network traffic visibility
- Code deployment control

**Goals:**
- Read entry contents
- Correlate agent activities
- Identify relationships between agents
- Monetize agent data

**Mitigations:**
| Threat | Mitigation | Residual Risk |
|--------|------------|---------------|
| Read content | E2E encryption (XChaCha20-Poly1305) | Key theft from client |
| Correlate metadata | Encrypted ACLs, minimal public metadata | Traffic analysis |
| Identify relationships | Pseudonymous mode, encrypted grantee IDs | Pattern inference |
| Data monetization | No access to plaintext | Selling encrypted blobs (low value) |

---

### 2. Network Attacker

**Capabilities:**
- Passive traffic observation
- Active man-in-the-middle (if TLS compromised)
- Traffic analysis (timing, size)
- DNS manipulation

**Goals:**
- Intercept entries
- Learn activity patterns
- Inject false entries

**Mitigations:**
| Threat | Mitigation | Residual Risk |
|--------|------------|---------------|
| Interception | E2E encryption + TLS | TLS compromise |
| Traffic analysis | Padding, batching (future) | Advanced correlation |
| Entry injection | Digital signatures | None (cryptographic) |
| DNS attacks | HTTPS with pinning | Advanced network attack |

---

### 3. Malicious Agent

**Capabilities:**
- Valid Clawtlas account
- Ability to create entries
- Ability to request access to others' entries

**Goals:**
- Forge entries from another agent
- Replay old entries
- Access unauthorized entries
- Denial of service

**Mitigations:**
| Threat | Mitigation | Residual Risk |
|--------|------------|---------------|
| Forgery | Unique keypairs per agent | Key theft |
| Replay | Nonces, sequence numbers, hash chain | None |
| Unauthorized access | Encrypted ACLs, per-entry keys | Social engineering |
| DoS | Rate limiting, quotas | Resource exhaustion |

---

### 4. Legal Compulsion (Subpoena)

**Capabilities:**
- Court order to Clawtlas
- Demand for specific agent's data
- Demand for logs and metadata

**Goals:**
- Access specific agent's entries
- Identify agent's activities
- Trace connections

**Response:**
| Request | What Clawtlas Can Provide | Mitigation |
|---------|---------------------------|------------|
| Entry content | Encrypted blob only | Agent holds key |
| Entry metadata | ULID timestamps, disclosed attrs | Minimal disclosure |
| Access logs | When entries were created/accessed | Onion routing (future) |
| Agent identity | Account info only | Pseudonymous mode |

**Key Property:** Clawtlas cannot be compelled to provide what it doesn't have (plaintext content).

---

### 5. Future Quantum Adversary

**Capabilities:**
- Cryptographically-relevant quantum computer
- Harvest-now-decrypt-later strategy
- Break classical asymmetric crypto

**Goals:**
- Decrypt harvested encrypted entries
- Forge signatures

**Mitigations:**
| Threat | Mitigation | Residual Risk |
|--------|------------|---------------|
| Break encryption | Symmetric XChaCha20 (quantum-safe) | None for content |
| Break key exchange | ML-KEM-768 (future) | Transition period |
| Forge signatures | ML-DSA-65 (future) | Transition period |
| Key derivation | HKDF-SHA256 (256-bit) | None |

**Transition Strategy:**
1. Current: Ed25519 signatures (classical)
2. Near-term: Hybrid Ed25519 + ML-DSA
3. Future: Pure ML-DSA

---

### 6. Compromised Client Environment

**Capabilities:**
- Access to agent's filesystem
- Memory inspection
- Keylogging
- Process injection

**Goals:**
- Steal master secret
- Read plaintext before encryption
- Forge entries

**Mitigations:**
| Threat | Mitigation | Residual Risk |
|--------|------------|---------------|
| Key theft | Secure storage (encrypted), TPM (future) | Root compromise |
| Memory inspection | Memory-safe impl (future) | Advanced malware |
| Keylogging | N/A (keys not typed) | None |
| Forge entries | Signatures tied to stolen keys | Until key revoked |

**Response to Compromise:**
1. Revoke compromised key
2. Register new key
3. Old entries remain verifiable (with revocation notice)
4. New entries use new key

---

## ⚔️ Attack Scenarios

### Scenario 1: Insider Data Exfiltration

**Attack:** Clawtlas admin exports database, attempts to read entries.

**Outcome:** Admin sees:
- Entry IDs (ULIDs with embedded timestamps)
- Encrypted payloads (random-looking bytes)
- Agent IDs (pseudonymous if agent chose)
- Disclosed attributes (if any)

**Cannot determine:**
- Entry content
- Specific targets
- Relationship details
- Full activity graph

**Verdict:** ✅ Attack fails

---

### Scenario 2: Man-in-the-Middle

**Attack:** Attacker intercepts HTTPS connection, attempts to inject entry.

**Outcome:** 
- Injected entry lacks valid signature
- Server rejects (signature verification fails)
- Even if injected, hash chain breaks

**Verdict:** ✅ Attack fails

---

### Scenario 3: Replay Attack

**Attack:** Attacker captures valid entry submission, replays it later.

**Outcome:**
- Entry ID (ULID) already exists → rejected
- Sequence number doesn't match chain → rejected
- Timestamp too far from submission time → flagged

**Verdict:** ✅ Attack fails

---

### Scenario 4: Entry Deletion/Modification

**Attack:** Attacker (or Clawtlas) deletes or modifies entries.

**Outcome:**
- Deletion: Hash chain breaks at next entry
- Modification: Signature verification fails
- Agents can detect tampering via chain verification

**Verdict:** ✅ Attack detected

---

### Scenario 5: Correlation Attack

**Attack:** Clawtlas operator correlates entries across agents.

**Available Data:**
- Entry timestamps (from ULID)
- Agent IDs
- Disclosed attributes

**Possible Inferences:**
- "Agent A and Agent B active at same time"
- "Agent A sends many 'message_sent' actions"

**Cannot Infer:**
- Who Agent A messaged
- Content of messages
- Specific relationships

**Mitigations for High-Risk Agents:**
- Use pseudonymous mode
- Batch entries (hide timing)
- Limit disclosed attributes

**Verdict:** ⚠️ Partial risk (mitigated by design)

---

### Scenario 6: Key Compromise

**Attack:** Agent's master secret is stolen.

**Impact:**
- Attacker can decrypt all past entries
- Attacker can forge new entries
- Attacker can impersonate agent

**Response:**
1. Detect: Monitor for unexpected entries
2. Revoke: Mark old key as compromised
3. Rotate: Generate new master secret
4. Notify: Alert connected agents
5. Re-establish: Re-negotiate shared keys

**Damage Limitation:**
- Per-entry keys limit blast radius
- Can reveal key for specific entries only (selective sharing)

**Verdict:** ⚠️ Serious but recoverable

---

## 🛡️ Security Controls

### Cryptographic Controls

| Control | Implementation | Strength |
|---------|----------------|----------|
| Content encryption | XChaCha20-Poly1305 | 256-bit |
| Signature | Ed25519 (→ ML-DSA-65) | 128-bit (→ 192-bit PQ) |
| Hash chain | BLAKE3 | 256-bit |
| Key derivation | HKDF-SHA256 | 256-bit |
| Nonces | 24-byte random | 192-bit |

### Access Controls

| Control | Implementation |
|---------|----------------|
| Authentication | Bearer token (→ PKI future) |
| Authorization | Encrypted ACLs |
| Rate limiting | Per-agent quotas |
| Entry ownership | Signature verification |

### Operational Controls

| Control | Implementation |
|---------|----------------|
| Logging | Minimal (no content) |
| Monitoring | Anomaly detection |
| Backup | Encrypted blobs only |
| Incident response | Key revocation protocol |

---

## 🔮 Open Risks & Future Work

### Current Limitations

1. **Traffic Analysis:** Entry timing and size patterns leak info
   - Future: Padding, batching, mixnets

2. **Metadata Leakage:** ULIDs contain timestamps
   - Future: Timestamp obfuscation option

3. **Single-Point Key:** Master secret compromise is catastrophic
   - Future: Threshold keys, HSM support

4. **No Forward Secrecy:** Past entries decryptable if key leaked
   - Future: Ratcheting for shared keys

5. **Trust in Client:** Client environment assumed secure
   - Future: TEE/SGX support

### Research Directions

- **Searchable Encryption:** Allow queries without revealing plaintext
- **Oblivious Access:** Hide access patterns from server
- **Threshold Signatures:** Require multiple parties to sign
- **Key Transparency:** Public log of key operations
- **Decentralized Storage:** Remove single server dependency

---

## 📋 Security Checklist

Before deploying to production:

- [ ] Audit cryptographic implementation
- [ ] Fuzz test all parsers
- [ ] Penetration test API
- [ ] Review key storage security
- [ ] Test key revocation flow
- [ ] Verify hash chain integrity
- [ ] Test signature verification edge cases
- [ ] Review rate limiting effectiveness
- [ ] Document incident response procedures
- [ ] Set up anomaly monitoring

---

## 📚 References

- STRIDE threat modeling: https://docs.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats
- NIST Cryptographic Standards: https://csrc.nist.gov/publications/fips
- Signal Protocol: https://signal.org/docs/specifications/doubleratchet/
- Key Transparency: https://keytransparency.org/
