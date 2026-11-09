// The masks are small PNGs; storing them without compression keeps ZIP export dependency-free.
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let i = 0; i < 8; i++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
});

function crc32(bytes) {
    let crc = 0xffffffff;
    for (const value of bytes) crc = crcTable[(crc ^ value) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

export function createMaskArchive(entries) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    let centralSize = 0;
    for (const { name, bytes } of entries) {
        const filename = encoder.encode(name);
        const checksum = crc32(bytes);
        const local = new Uint8Array(30 + filename.length);
        const header = new DataView(local.buffer);
        header.setUint32(0, 0x04034b50, true);
        header.setUint16(4, 20, true);
        header.setUint16(6, 0x0800, true);
        header.setUint16(12, 0x21, true);
        header.setUint32(14, checksum, true);
        header.setUint32(18, bytes.length, true);
        header.setUint32(22, bytes.length, true);
        header.setUint16(26, filename.length, true);
        local.set(filename, 30);
        localParts.push(local, bytes);

        const central = new Uint8Array(46 + filename.length);
        const directory = new DataView(central.buffer);
        directory.setUint32(0, 0x02014b50, true);
        directory.setUint16(4, 20, true);
        directory.setUint16(6, 20, true);
        directory.setUint16(8, 0x0800, true);
        directory.setUint16(14, 0x21, true);
        directory.setUint32(16, checksum, true);
        directory.setUint32(20, bytes.length, true);
        directory.setUint32(24, bytes.length, true);
        directory.setUint16(28, filename.length, true);
        directory.setUint32(42, offset, true);
        central.set(filename, 46);
        centralParts.push(central);
        centralSize += central.length;
        offset += local.length + bytes.length;
    }
    const end = new Uint8Array(22);
    const directoryEnd = new DataView(end.buffer);
    directoryEnd.setUint32(0, 0x06054b50, true);
    directoryEnd.setUint16(8, entries.length, true);
    directoryEnd.setUint16(10, entries.length, true);
    directoryEnd.setUint32(12, centralSize, true);
    directoryEnd.setUint32(16, offset, true);
    return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
}
