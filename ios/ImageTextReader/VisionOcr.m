#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>
#import <Vision/Vision.h>

/**
 * Apple Vision OCR with automatic language detection.
 * Supports Latin and Cyrillic (ru/uk) without a language picker.
 */
@interface VisionOcr : NSObject <RCTBridgeModule>
@end

@implementation VisionOcr

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_EXPORT_METHOD(recognize:(NSString *)imageUri
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    UIImage *image = [VisionOcr loadImageFromUri:imageUri];
    if (image == nil || image.CGImage == nil) {
      reject(@"VISION_IMAGE_FAILED", @"Could not load image for OCR", nil);
      return;
    }

    CGImagePropertyOrientation orientation =
      [VisionOcr cgOrientationFromImageOrientation:image.imageOrientation];

    VNImageRequestHandler *handler =
      [[VNImageRequestHandler alloc] initWithCGImage:image.CGImage
                                         orientation:orientation
                                             options:@{}];

    VNRecognizeTextRequest *request =
      [[VNRecognizeTextRequest alloc] initWithCompletionHandler:^(VNRequest *req, NSError *error) {
        if (error != nil) {
          reject(@"VISION_ERROR", error.localizedDescription, error);
          return;
        }

        NSMutableArray<NSString *> *lines = [NSMutableArray new];
        for (VNRecognizedTextObservation *observation in req.results) {
          VNRecognizedText *top = [observation topCandidates:1].firstObject;
          if (top.string.length > 0) {
            [lines addObject:top.string];
          }
        }

        NSString *text = [[lines componentsJoinedByString:@"\n"]
          stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];

        resolve(text ?: @"");
      }];

    request.recognitionLevel = VNRequestTextRecognitionLevelAccurate;
    request.usesLanguageCorrection = YES;
    [VisionOcr configureLanguagesForRequest:request];

    NSError *requestError = nil;
    BOOL ok = [handler performRequests:@[ request ] error:&requestError];
    if (!ok) {
      reject(@"VISION_ERROR", requestError.localizedDescription ?: @"Vision OCR failed", requestError);
    }
  });
}

+ (void)configureLanguagesForRequest:(VNRecognizeTextRequest *)request
{
  // Prefer Cyrillic languages first so mixed/ambiguous pages lean Russian.
  NSArray<NSString *> *preferred = @[
    @"ru-RU",
    @"uk-UA",
    @"bg-BG",
    @"en-US",
    @"fr-FR",
    @"de-DE",
    @"es-ES",
    @"it-IT",
    @"pt-BR",
  ];

  NSError *langError = nil;
  NSArray<NSString *> *supported =
    [request supportedRecognitionLanguagesAndReturnError:&langError];

  NSMutableArray<NSString *> *languages = [NSMutableArray new];
  if (supported.count > 0) {
    for (NSString *code in preferred) {
      if ([supported containsObject:code]) {
        [languages addObject:code];
      }
    }
  }

  if (languages.count == 0) {
    [languages addObject:@"en-US"];
  }

  request.recognitionLanguages = languages;

  if (@available(iOS 16.0, *)) {
    request.automaticallyDetectsLanguage = YES;
  }
}

+ (CGImagePropertyOrientation)cgOrientationFromImageOrientation:(UIImageOrientation)orientation
{
  switch (orientation) {
    case UIImageOrientationUp:
      return kCGImagePropertyOrientationUp;
    case UIImageOrientationDown:
      return kCGImagePropertyOrientationDown;
    case UIImageOrientationLeft:
      return kCGImagePropertyOrientationLeft;
    case UIImageOrientationRight:
      return kCGImagePropertyOrientationRight;
    case UIImageOrientationUpMirrored:
      return kCGImagePropertyOrientationUpMirrored;
    case UIImageOrientationDownMirrored:
      return kCGImagePropertyOrientationDownMirrored;
    case UIImageOrientationLeftMirrored:
      return kCGImagePropertyOrientationLeftMirrored;
    case UIImageOrientationRightMirrored:
      return kCGImagePropertyOrientationRightMirrored;
    default:
      return kCGImagePropertyOrientationUp;
  }
}

+ (UIImage *)loadImageFromUri:(NSString *)imageUri
{
  NSURL *url = [NSURL URLWithString:imageUri];
  if (url == nil) {
    return nil;
  }

  NSString *path = url.path;
  UIImage *image = nil;

  if ([imageUri hasPrefix:@"file://"] || path.length > 0) {
    image = [UIImage imageWithContentsOfFile:path];
  }

  if (image == nil) {
    NSData *data = [NSData dataWithContentsOfURL:url];
    if (data != nil) {
      image = [UIImage imageWithData:data];
    }
  }

  return image;
}

@end
