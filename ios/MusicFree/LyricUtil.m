#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface LyricUtil : RCTEventEmitter <RCTBridgeModule>
@end

@implementation LyricUtil

RCT_EXPORT_MODULE();

- (NSArray<NSString *> *)supportedEvents {
  return @[];
}

@end
