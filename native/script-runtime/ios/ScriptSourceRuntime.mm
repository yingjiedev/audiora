#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <CommonCrypto/CommonCrypto.h>
#import <Security/Security.h>
#include "../ScriptRuntime.h"
#include <memory>
#include <unordered_map>

static NSString *Text(const std::string &value) {
    return [[NSString alloc] initWithBytes:value.data() length:value.size() encoding:NSUTF8StringEncoding] ?: @"";
}

static NSData *Bytes(NSDictionary *request, NSString *key) {
    NSData *data = [[NSData alloc] initWithBase64EncodedString:request[key] options:0];
    if (!data) @throw [NSException exceptionWithName:@"InvalidBytes" reason:@"Invalid byte encoding" userInfo:nil];
    return data;
}

// Strip the SubjectPublicKeyInfo wrapper for Security's PKCS#1 key importer.
static NSData *RsaKey(NSData *der) {
    const uint8_t *bytes = (const uint8_t *)der.bytes;
    for (NSUInteger i = 0; i + 3 < der.length; ++i) {
        if (bytes[i] != 0x03) continue;
        NSUInteger start = i + 1;
        NSUInteger length = bytes[start++];
        if (length & 0x80) {
            NSUInteger count = length & 0x7f;
            if (count == 0 || count > 4 || start + count >= der.length) continue;
            length = 0;
            while (count--) length = (length << 8) | bytes[start++];
        }
        if (length > 1 && start + length == der.length && bytes[start] == 0 && bytes[start + 1] == 0x30) {
            return [der subdataWithRange:NSMakeRange(start + 1, length - 1)];
        }
    }
    return der;
}

static std::string Crypto(const std::string &raw) {
    @autoreleasepool {
        NSDictionary *response;
        @try {
            NSDictionary *request = [NSJSONSerialization JSONObjectWithData:[Text(raw) dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
            NSString *operation = request[@"operation"];
            NSString *result;
            if ([operation isEqualToString:@"md5"]) {
                NSData *data = [request[@"text"] dataUsingEncoding:NSUTF8StringEncoding];
                unsigned char digest[CC_MD5_DIGEST_LENGTH];
                CC_MD5(data.bytes, (CC_LONG)data.length, digest);
                NSMutableString *hex = [NSMutableString string];
                for (int i = 0; i < CC_MD5_DIGEST_LENGTH; ++i) [hex appendFormat:@"%02x", digest[i]];
                result = hex;
            } else if ([operation isEqualToString:@"randomBytes"]) {
                NSInteger size = [request[@"size"] integerValue];
                if (size < 0 || size > 262144) @throw [NSException exceptionWithName:@"InvalidSize" reason:@"Invalid random byte count" userInfo:nil];
                NSMutableData *data = [NSMutableData dataWithLength:size];
                if (SecRandomCopyBytes(kSecRandomDefault, size, data.mutableBytes) != errSecSuccess) @throw [NSException exceptionWithName:@"RandomFailed" reason:@"Random generation failed" userInfo:nil];
                result = [data base64EncodedStringWithOptions:0];
            } else if ([operation isEqualToString:@"aesEncrypt"]) {
                NSString *mode = request[@"mode"];
                BOOL cbc = [mode isEqualToString:@"aes-128-cbc"];
                if (!cbc && ![mode isEqualToString:@"aes-128-ecb"]) @throw [NSException exceptionWithName:@"InvalidMode" reason:@"Unsupported AES mode" userInfo:nil];
                NSData *data = Bytes(request, @"data"), *key = Bytes(request, @"key");
                NSData *iv = cbc ? Bytes(request, @"iv") : nil;
                if (key.length != 16 || (cbc && iv.length != 16)) @throw [NSException exceptionWithName:@"InvalidKey" reason:@"Invalid AES key or IV" userInfo:nil];
                NSMutableData *encrypted = [NSMutableData dataWithLength:data.length + kCCBlockSizeAES128];
                size_t written = 0;
                CCCryptorStatus status = CCCrypt(kCCEncrypt, kCCAlgorithmAES, cbc ? kCCOptionPKCS7Padding : kCCOptionECBMode,
                    key.bytes, key.length, iv.bytes, data.bytes, data.length, encrypted.mutableBytes, encrypted.length, &written);
                if (status != kCCSuccess) @throw [NSException exceptionWithName:@"EncryptionFailed" reason:@"AES encryption failed" userInfo:nil];
                encrypted.length = written;
                result = [encrypted base64EncodedStringWithOptions:0];
            } else if ([operation isEqualToString:@"rsaEncrypt"]) {
                if ([request[@"key"] length] > 8192) @throw [NSException exceptionWithName:@"InvalidSize" reason:@"RSA public key is too large" userInfo:nil];
                NSString *pem = request[@"key"];
                for (NSString *marker in @[@"-----BEGIN PUBLIC KEY-----", @"-----END PUBLIC KEY-----", @"-----BEGIN RSA PUBLIC KEY-----", @"-----END RSA PUBLIC KEY-----"]) {
                    pem = [pem stringByReplacingOccurrencesOfString:marker withString:@""];
                }
                NSData *der = [[NSData alloc] initWithBase64EncodedString:pem options:NSDataBase64DecodingIgnoreUnknownCharacters];
                if (!der) @throw [NSException exceptionWithName:@"InvalidKey" reason:@"Invalid RSA public key" userInfo:nil];
                NSDictionary *attributes = @{(__bridge id)kSecAttrKeyType: (__bridge id)kSecAttrKeyTypeRSA, (__bridge id)kSecAttrKeyClass: (__bridge id)kSecAttrKeyClassPublic};
                SecKeyRef key = SecKeyCreateWithData((__bridge CFDataRef)RsaKey(der), (__bridge CFDictionaryRef)attributes, nil);
                if (!key) @throw [NSException exceptionWithName:@"InvalidKey" reason:@"Invalid RSA public key" userInfo:nil];
                NSData *input = Bytes(request, @"data");
                size_t size = SecKeyGetBlockSize(key);
                if (input.length > size || size > 512) {
                    CFRelease(key);
                    @throw [NSException exceptionWithName:@"InvalidSize" reason:@"RSA input is too large" userInfo:nil];
                }
                NSMutableData *padded = [NSMutableData dataWithLength:size];
                [padded replaceBytesInRange:NSMakeRange(size - input.length, input.length) withBytes:input.bytes];
                CFDataRef output = SecKeyCreateEncryptedData(key, kSecKeyAlgorithmRSAEncryptionRaw, (__bridge CFDataRef)padded, nil);
                CFRelease(key);
                if (!output) @throw [NSException exceptionWithName:@"EncryptionFailed" reason:@"RSA encryption failed" userInfo:nil];
                result = [(__bridge NSData *)output base64EncodedStringWithOptions:0];
                CFRelease(output);
            } else {
                @throw [NSException exceptionWithName:@"UnsupportedUtility" reason:@"Unsupported utility" userInfo:nil];
            }
            response = @{@"data": result ?: @""};
        } @catch (NSException *error) {
            response = @{@"error": error.reason ?: @"Utility failed"};
        }
        NSData *json = [NSJSONSerialization dataWithJSONObject:response options:0 error:nil];
        return std::string((const char *)json.bytes, json.length);
    }
}

@interface ScriptSourceRuntime : RCTEventEmitter <RCTBridgeModule> {
    std::mutex _mutex;
    std::unordered_map<std::string, std::shared_ptr<audiora::ScriptRuntime>> _runtimes;
    BOOL _invalidated;
}
@end

@implementation ScriptSourceRuntime
RCT_EXPORT_MODULE(ScriptSourceRuntime)
+ (BOOL)requiresMainQueueSetup { return NO; }
- (NSArray<NSString *> *)supportedEvents { return @[@"ScriptSourceRuntimeEvent"]; }

RCT_EXPORT_METHOD(create:(NSString *)sourceId bootstrap:(NSString *)bootstrap script:(NSString *)script
                  resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
    std::lock_guard<std::mutex> lock(_mutex);
    std::string key(sourceId.UTF8String);
    if (_invalidated || _runtimes.size() >= 8 || _runtimes.count(key) || [script lengthOfBytesUsingEncoding:NSUTF8StringEncoding] > 1024 * 1024) {
        reject(@"SourceRuntimeUnavailable", @"Script runtime is unavailable or input exceeds limits", nil);
        return;
    }
    __weak ScriptSourceRuntime *weakSelf = self;
    _runtimes[key] = std::make_shared<audiora::ScriptRuntime>(std::string(bootstrap.UTF8String), std::string(script.UTF8String),
        [weakSelf, sourceId](const std::string &payload) {
            NSString *message = Text(payload);
            dispatch_async(dispatch_get_main_queue(), ^{
                ScriptSourceRuntime *target = weakSelf;
                if (target) [target sendEventWithName:@"ScriptSourceRuntimeEvent" body:@{@"id": sourceId, @"payload": message}];
            });
        }, Crypto);
    resolve(nil);
}

RCT_EXPORT_METHOD(post:(NSString *)sourceId payload:(NSString *)payload) {
    std::lock_guard<std::mutex> lock(_mutex);
    auto found = _runtimes.find(std::string(sourceId.UTF8String));
    if (found != _runtimes.end()) found->second->dispatch(std::string(payload.UTF8String));
}

RCT_EXPORT_METHOD(destroy:(NSString *)sourceId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
    std::shared_ptr<audiora::ScriptRuntime> runtime;
    {
        std::lock_guard<std::mutex> lock(_mutex);
        auto found = _runtimes.find(std::string(sourceId.UTF8String));
        if (found != _runtimes.end()) {
            runtime = found->second;
            _runtimes.erase(found);
        }
    }
    if (runtime) runtime->stop();
    resolve(nil);
}

- (void)invalidate {
    std::unordered_map<std::string, std::shared_ptr<audiora::ScriptRuntime>> previous;
    {
        std::lock_guard<std::mutex> lock(_mutex);
        _invalidated = YES;
        previous.swap(_runtimes);
    }
    for (auto &entry : previous) entry.second->stop();
    [super invalidate];
}
@end
