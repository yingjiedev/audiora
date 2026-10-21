Pod::Spec.new do |s|
  s.name = 'AudioraScriptRuntime'
  s.version = '1.0.0'
  s.summary = 'Isolated custom source script runtime'
  s.homepage = 'https://github.com/yingjiedev/audiora'
  s.license = { :type => 'AGPL-3.0' }
  s.author = 'Audiora contributors'
  s.source = { :git => 'https://github.com/yingjiedev/audiora.git' }
  s.platform = :ios, '16.4'
  s.requires_arc = true
  s.source_files = 'ScriptRuntime.{h,cpp}', 'ios/*.mm', 'quickjs/*.{c,h}'
  s.private_header_files = 'ScriptRuntime.h', 'quickjs/*.h'
  s.frameworks = 'Foundation', 'Security'
  s.resource_bundles = { 'AudioraScriptRuntimeLicenses' => ['quickjs/LICENSE'] }
  s.dependency 'React-Core'
  s.pod_target_xcconfig = {
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'GCC_C_LANGUAGE_STANDARD' => 'gnu11',
    'GCC_PREPROCESSOR_DEFINITIONS' => '$(inherited) _GNU_SOURCE QUICKJS_NG_BUILD',
    'OTHER_CFLAGS' => '$(inherited) -funsigned-char',
  }
end
