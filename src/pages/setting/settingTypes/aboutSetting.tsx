import React, { useEffect, useRef, useState } from "react";
import { controlSize, radius, spacing } from "@/constants/designSystem";
import {
    Image,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";
import rpx, { fontRpx } from "@/utils/rpx";
import { ImgAsset } from "@/constants/assetsConst";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon";
import Divider from "@/components/base/divider";
import LinkText from "@/components/base/linkText";
import useOrientation from "@/hooks/useOrientation";
import DeviceInfo from "react-native-device-info";
import buildInfo from "@/constants/buildInfo";
import { useI18N } from "@/core/i18n";
import { showDialog } from "@/components/dialogs/useDialog";
import { checkAppRelease, getLatestAnnouncement } from "@/core/appRelease";
import { getFastestGithubDownloadUrl } from "@/core/githubNetwork";
import { appUpdate } from "@/core/appUpdateState";
import Toast from "@/utils/toast";
import SettingSection from "../components/settingSection";
import AppUpdateStatus from "../components/appUpdateStatus";

export default function AboutSetting() {
    const orientation = useOrientation();
    const { t } = useI18N();
    const version = DeviceInfo.getVersion(); // 从 package.json 获取版本号
    const buildTime = buildInfo.buildTime; // 从构建信息文件获取构建时间
    const updateState = appUpdate.state.useValue();
    const [updateActivity, setUpdateActivity] = useState<"checking" | "selecting" | null>(null);
    const updateRequestRef = useRef<AbortController | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            updateRequestRef.current?.abort();
        };
    }, []);

    async function handleDownload(downloadUrl: string) {
        if (!mountedRef.current || updateRequestRef.current) {
            return;
        }
        const controller = new AbortController();
        updateRequestRef.current = controller;
        setUpdateActivity("selecting");

        try {
            const selectedUrl = await getFastestGithubDownloadUrl(downloadUrl, controller.signal);
            if (controller.signal.aborted) {
                return;
            }
            try {
                await Linking.openURL(selectedUrl);
            } catch (error) {
                if (selectedUrl === downloadUrl || controller.signal.aborted) {
                    throw error;
                }
                await Linking.openURL(downloadUrl);
            }
        } catch {
            if (!controller.signal.aborted) {
                Toast.warn(t("checkUpdate.error.downloadFailed"));
            }
        } finally {
            updateRequestRef.current = null;
            if (mountedRef.current) {
                setUpdateActivity(null);
            }
        }
    }

    async function handleCheckUpdate() {
        if (!mountedRef.current || updateRequestRef.current) {
            return;
        }
        const controller = new AbortController();
        updateRequestRef.current = controller;
        setUpdateActivity("checking");

        try {
            const result = await checkAppRelease(controller.signal);
            if (controller.signal.aborted) {
                return;
            }
            if (!result.hasUpdate) {
                Toast.success(t("checkUpdate.error.latestVersion"));
                return;
            }

            if (Platform.OS === "android") {
                showDialog("AppUpdateDialog", { release: result.release });
                return;
            }

            const downloadUrl = result.release.download[0];
            showDialog("SimpleDialog", {
                title: t("checkUpdate.newVersion", {
                    version: result.release.version,
                }),
                content: (
                    <View>
                        {result.release.changeLog.map((item, index) => (
                            <ThemeText key={`${index}-${item}`} style={style.releaseLine}>
                                {`${index + 1}. ${item}`}
                            </ThemeText>
                        ))}
                    </View>
                ),
                okText: downloadUrl ? t("checkUpdate.download") : undefined,
                onOk: downloadUrl
                    ? () => handleDownload(downloadUrl)
                    : undefined,
            });
        } catch {
            if (!controller.signal.aborted) {
                Toast.warn(t("checkUpdate.error.cannotConnectToServer"));
            }
        } finally {
            updateRequestRef.current = null;
            if (mountedRef.current) {
                setUpdateActivity(null);
            }
        }
    }

    async function handleShowAnnouncement() {
        try {
            const announcement = await getLatestAnnouncement();
            if (!announcement) {
                Toast.warn(t("toast.announcementNone"));
                return;
            }

            showDialog("SimpleDialog", {
                title: announcement.title,
                content: (
                    <View>
                        {announcement.content.map((item, index) => (
                            <ThemeText key={`${index}-${item}`} style={style.releaseLine}>
                                {item || " "}
                            </ThemeText>
                        ))}
                    </View>
                ),
            });
        } catch {
            Toast.warn(t("announcement.error"));
        }
    }

    return (
        <View
            style={[
                style.wrapper,
                orientation === "horizontal"
                    // eslint-disable-next-line react-native/no-inline-styles -- Dynamic orientation layout
                    ? {
                        flexDirection: "row",
                    }
                    : null,
            ]}>
            <View
                style={[
                    style.header,
                    orientation === "horizontal" ? style.horizontalSize : null,
                ]}>
                <Image
                    source={ImgAsset.logo}
                    style={style.image}
                    resizeMode="contain"
                />
                <ThemeText fontSize="title" style={style.appTitle}>
                    Audiora
                </ThemeText>
                <ThemeText fontColor="textSecondary" style={style.versionText}>
                    {t("about.version", { version })}
                </ThemeText>
                <ThemeText fontColor="textSecondary" style={style.buildText}>
                    {t("about.buildTime", { buildTime })}
                </ThemeText>
            </View>
            <ScrollView
                contentContainerStyle={style.scrollViewContainer}
                style={style.scrollView}>

                <SettingSection title={t("home.aboutAndUpdate")}>
                    {Platform.OS === "android" && updateState.phase !== "idle" ? <AppUpdateStatus /> : <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("sidebar.checkUpdate")}
                        accessibilityState={{ busy: updateActivity !== null, disabled: updateActivity !== null }}
                        disabled={updateActivity !== null}
                        style={style.actionRow}
                        onPress={handleCheckUpdate}>
                        <View style={style.actionText}>
                            <ThemeText>
                                {t(updateActivity === "selecting"
                                    ? "checkUpdate.selectingDownload"
                                    : updateActivity === "checking"
                                        ? "checkUpdate.checking"
                                        : "sidebar.checkUpdate")}
                            </ThemeText>
                        </View>
                        <ThemeText fontColor="textSecondary">
                            {t("checkUpdate.currentVersion", { version })}
                        </ThemeText>
                        <Icon name="chevron-right" size={rpx(28)} />
                    </Pressable>}
                    <Divider style={style.divider} />
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("announcement.view")}
                        style={style.actionRow}
                        onPress={handleShowAnnouncement}>
                        <View style={style.actionText}>
                            <ThemeText>
                                {t("announcement.view")}
                            </ThemeText>
                        </View>
                        <Icon name="chevron-right" size={rpx(28)} />
                    </Pressable>
                </SettingSection>

                <SettingSection
                    title={t("about.positioningTitle")}
                    cardStyle={style.infoCard}>
                    <ThemeText style={style.cardContent}>
                        {t("about.positioningContent")}
                    </ThemeText>
                </SettingSection>

                <SettingSection
                    title={t("about.responsibilityTitle")}
                    cardStyle={style.infoCard}>
                    <ThemeText style={style.cardContent}>
                        {t("about.responsibilityContent")}
                    </ThemeText>
                </SettingSection>

                <SettingSection
                    title={t("about.originalAuthor")}
                    cardStyle={style.infoCard}>
                    <ThemeText style={style.cardContent}>猫头猫</ThemeText>
                    <LinkText linkTo="https://github.com/maotoumao/MusicFree">
                        https://github.com/maotoumao/MusicFree
                    </LinkText>
                </SettingSection>

                <SettingSection
                    title={t("about.upstreamAuthor")}
                    cardStyle={style.infoCard}>
                    <ThemeText style={style.cardContent}>Toskysun</ThemeText>
                    <LinkText linkTo="https://github.com/Toskysun/MusicFree">
                        https://github.com/Toskysun/MusicFree
                    </LinkText>
                </SettingSection>

                <SettingSection
                    title={t("about.directFoundation")}
                    cardStyle={style.infoCard}>
                    <ThemeText style={style.cardContent}>Merilune</ThemeText>
                    <LinkText linkTo="https://github.com/Merilune/MusicFree">
                        https://github.com/Merilune/MusicFree
                    </LinkText>
                </SettingSection>
            </ScrollView>
        </View>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        flex: 1,
    },
    header: {
        // 不要写 rpx(750)：它等于整屏宽度，再叠上 HorizontalSafeAreaView
        // 的左右 inset 就会横向溢出。用 100% 让它跟着安全区收缩。
        width: "100%",
        minHeight: rpx(240),
        paddingVertical: spacing.lg,
        justifyContent: "center",
        alignItems: "center",
    },
    horizontalSize: {
        width: rpx(600),
        height: "100%",
    },
    image: {
        width: rpx(96),
        height: rpx(96),
        borderRadius: radius.lg,
    },
    appTitle: {
        marginTop: rpx(24),
    },
    versionText: {
        marginTop: rpx(12),
        opacity: 0.8,
    },
    buildText: {
        marginTop: rpx(8),
        marginBottom: rpx(32),
        opacity: 0.6,
        fontSize: fontRpx(24),
    },
    scrollView: {
        flex: 1,
    },
    scrollViewContainer: {
        paddingBottom: rpx(96),
    },
    infoCard: {
        padding: spacing.lg,
    },
    cardContent: {
        fontSize: fontRpx(28),
    },
    actionRow: {
        minHeight: Math.max(44, controlSize.minimumTouch),
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.xxl,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    divider: {
        marginHorizontal: spacing.xxl,
        width: "auto",
        height: StyleSheet.hairlineWidth,
    },
    actionText: {
        flex: 1,
        minWidth: 0,
    },
    releaseLine: {
        marginBottom: rpx(10),
        lineHeight: fontRpx(40),
    },
});
