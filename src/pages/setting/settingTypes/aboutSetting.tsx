import React from "react";
import {
    Image,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";
import rpx, { fontRpx } from "@/utils/rpx";
import { ImgAsset } from "@/constants/assetsConst";
import ThemeText from "@/components/base/themeText";
import LinkText from "@/components/base/linkText";
import useOrientation from "@/hooks/useOrientation";
import DeviceInfo from "react-native-device-info";
import buildInfo from "@/constants/buildInfo";
import { useI18N } from "@/core/i18n";
import { showDialog } from "@/components/dialogs/useDialog";
import { checkAppRelease, getLatestAnnouncement } from "@/core/appRelease";
import Toast from "@/utils/toast";
import SettingSection from "../components/settingSection";

export default function AboutSetting() {
    const orientation = useOrientation();
    const { t } = useI18N();
    const version = DeviceInfo.getVersion(); // 从 package.json 获取版本号
    const buildTime = buildInfo.buildTime; // 从构建信息文件获取构建时间

    async function handleCheckUpdate() {
        try {
            const result = await checkAppRelease();
            if (!result.hasUpdate) {
                Toast.success(t("checkUpdate.error.latestVersion"));
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
                    ? () => {
                        Linking.openURL(downloadUrl).catch(() => undefined);
                    }
                    : undefined,
            });
        } catch {
            Toast.warn(t("checkUpdate.error.cannotConnectToServer"));
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
                    source={ImgAsset.author}
                    style={style.image}
                    resizeMode="contain"
                />
                <ThemeText fontSize="title" style={style.appTitle}>
                    Audiora
                </ThemeText>
                <ThemeText style={style.versionText}>
                    {t("about.version", { version })}
                </ThemeText>
                <ThemeText style={style.buildText}>
                    {t("about.buildTime", { buildTime })}
                </ThemeText>
            </View>
            <ScrollView
                contentContainerStyle={style.scrollViewContainer}
                style={style.scrollView}>

                <SettingSection title={t("home.aboutAndUpdate")}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("sidebar.checkUpdate")}
                        style={style.actionRow}
                        onPress={handleCheckUpdate}>
                        <View style={style.actionText}>
                            <ThemeText>
                                {t("sidebar.checkUpdate")}
                            </ThemeText>
                        </View>
                        <ThemeText fontColor="textSecondary">
                            {t("checkUpdate.currentVersion", { version })}
                        </ThemeText>
                    </Pressable>
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
        width: rpx(750),
        height: rpx(300),
        justifyContent: "center",
        alignItems: "center",
    },
    horizontalSize: {
        width: rpx(600),
        height: "100%",
    },
    image: {
        width: rpx(150),
        height: rpx(150),
        borderRadius: rpx(28),
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
        padding: rpx(24),
    },
    cardContent: {
        fontSize: fontRpx(28),
    },
    actionRow: {
        minHeight: rpx(92),
        paddingHorizontal: rpx(24),
        flexDirection: "row",
        alignItems: "center",
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
