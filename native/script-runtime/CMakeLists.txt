cmake_minimum_required(VERSION 3.22.1)
project(audiora_script_runtime LANGUAGES C CXX)

add_library(audiora-quickjs STATIC
    quickjs/quickjs.c
    quickjs/dtoa.c
    quickjs/libregexp.c
    quickjs/libunicode.c
)
set_target_properties(audiora-quickjs PROPERTIES POSITION_INDEPENDENT_CODE ON C_STANDARD 11)
target_compile_definitions(audiora-quickjs PRIVATE _GNU_SOURCE QUICKJS_NG_BUILD)
target_compile_options(audiora-quickjs PRIVATE -funsigned-char)

add_library(audiora-script-runtime SHARED ScriptRuntime.cpp android/ScriptRuntimeJni.cpp)
target_compile_features(audiora-script-runtime PRIVATE cxx_std_17)
target_compile_options(audiora-script-runtime PRIVATE -fexceptions)
target_link_options(audiora-script-runtime PRIVATE -Wl,-z,max-page-size=16384)
target_link_libraries(audiora-script-runtime PRIVATE audiora-quickjs android log)
