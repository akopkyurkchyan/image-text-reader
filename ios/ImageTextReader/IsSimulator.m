#import <React/RCTBridgeModule.h>

@interface IsSimulator : NSObject <RCTBridgeModule>
@end

@implementation IsSimulator

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (NSDictionary *)constantsToExport
{
#if TARGET_OS_SIMULATOR
  return @{@"isSimulator": @YES};
#else
  return @{@"isSimulator": @NO};
#endif
}

@end
