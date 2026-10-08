declare namespace IPlugin {
  // Augment IMediaSourceResult to optionally carry ekey for mflac sources
  interface IMediaSourceResult {
    ekey?: string;
    qmcRawKey?: string;
    /** CENC AES-CTR content key (16-byte hexadecimal string). */
    cek?: string;
  }
}

