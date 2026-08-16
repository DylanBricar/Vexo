import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_KEY = "0123456789abcdef".repeat(4);
const originalKey = process.env.ENCRYPTION_KEY;

beforeEach(() => {
  vi.resetModules();
  process.env.ENCRYPTION_KEY = VALID_KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalKey === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = originalKey;
});

describe("crypto", () => {
  it("chiffre avec authentification et déchiffre le contenu", async () => {
    const { decrypt, encrypt } = await import("./crypto");
    const encrypted = encrypt("message privé");
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith("0") ? "1" : "0"}`;

    expect(encrypted).not.toContain("message privé");
    expect(decrypt(encrypted)).toBe("message privé");
    expect(() => decrypt(tampered)).toThrow();
  });

  it("signe, vérifie et expire une session", async () => {
    const now = 1_800_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const { generateToken, verifyToken } = await import("./crypto");
    const token = generateToken(2);
    const tampered = `${token.slice(0, -1)}${token.endsWith("0") ? "1" : "0"}`;

    expect(verifyToken(token)).toBe(2);
    expect(verifyToken(tampered)).toBeNull();
    vi.spyOn(Date, "now").mockReturnValue(now + 24 * 60 * 60 * 1_000 + 1);
    expect(verifyToken(token)).toBeNull();
  });

  it("rejette les jetons mal formés et les horodatages futurs", async () => {
    const now = 1_800_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const { generateToken, verifyToken } = await import("./crypto");

    expect(verifyToken("invalide")).toBeNull();
    expect(verifyToken("2:123:pas-une-signature")).toBeNull();
    vi.spyOn(Date, "now").mockReturnValue(now - 60_001);
    expect(verifyToken(generateToken(2))).toBe(2);
    vi.spyOn(Date, "now").mockReturnValue(now);
    const futureToken = generateToken(2);
    vi.spyOn(Date, "now").mockReturnValue(now - 60_001);
    expect(verifyToken(futureToken)).toBeNull();
  });

  it("préserve les anciennes valeurs en clair pendant la migration", async () => {
    const { decryptOrNull, encryptOrNull } = await import("./crypto");

    expect(encryptOrNull(null)).toBeNull();
    expect(decryptOrNull(null)).toBeNull();
    expect(decryptOrNull("ancienne valeur")).toBe("ancienne valeur");
    expect(decryptOrNull("data:image/png;base64,aGVsbG8=")).toBe(
      "data:image/png;base64,aGVsbG8=",
    );
    expect(decryptOrNull(encryptOrNull("nouvelle valeur"))).toBe(
      "nouvelle valeur",
    );
  });

  it("valide la clé seulement au premier usage", async () => {
    process.env.ENCRYPTION_KEY = "clé-invalide";
    const cryptoModule = await import("./crypto");

    expect(() => cryptoModule.encrypt("message")).toThrow(/64 caractères/);
  });
});
