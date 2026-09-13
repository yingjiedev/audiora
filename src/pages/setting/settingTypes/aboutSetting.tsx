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
import Theme from "@/core/theme";
import DeviceInfo from "react-native-device-info";
import buildInfo from "@/constants/buildInfo";
import useHasCustomBackground from "@/hooks/useHasCustomBackground";
import { useI18N } from "@/core/i18n";
import Icon from "@/components/base/icon";
import { showDialog } from "@/components/dialogs/useDialog";
import { checkAppRelease, getLatestAnnouncement } from "@/core/appRelease";
import Toast from "@/utils/toast";

export default function AboutSetting() {
    const orientation = useOrientation();
    const { colors } = Theme.useTheme();
    const { t } = useI18N();
    const hasCustomBackground = useHasCustomBackground();
    const version = DeviceInfo.getVersion(); // 从 package.json 获取版本号
    const buildTime = buildInfo.buildTime; // 从构建信息文件获取构建时间
    const cardChrome = hasCustomBackground
        ? {
            elevation: 0,
            shadowColor: "transparent",
            shadowOpacity: 0,
            borderWidth: 0,
        }
        : null;

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

                <View style={[style.actionCard, { backgroundColor: colors.card }, cardChrome]}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("sidebar.checkUpdate")}
                        style={style.actionRow}
                        onPress={handleCheckUpdate}>
                        <Icon name="arrow-path" size={rpx(34)} color={colors.primary} />
                        <View style={style.actionText}>
                            <ThemeText fontSize="subTitle" fontWeight="semibold">
                                {t("sidebar.checkUpdate")}
                            </ThemeText>
                            <ThemeText fontSize="description" fontColor="textSecondary" style={style.actionDescription}>
                                {t("checkUpdate.currentVersion", { version })}
                            </ThemeText>
                        </View>
                    </Pressable>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("announcement.view")}
                        style={style.actionRow}
                        onPress={handleShowAnnouncement}>
                        <Icon name="information-circle" size={rpx(34)} color={colors.primary} />
                        <View style={style.actionText}>
                            <ThemeText fontSize="subTitle" fontWeight="semibold">
                                {t("announcement.view")}
                            </ThemeText>
                            <ThemeText fontSize="description" fontColor="textSecondary" style={style.actionDescription}>
                                {t("announcement.description")}
                            </ThemeText>
                        </View>
                    </Pressable>
                </View>

                <View
                    style={[
                        style.infoCard,
                        { backgroundColor: colors.card },
                        cardChrome,
                    ]}>
                    <ThemeText fontSize="subTitle" style={style.cardTitle}>
                        {t("about.positioningTitle")}
                    </ThemeText>
                    <ThemeText style={style.cardContent}>
                        {t("about.positioningContent")}
                    </ThemeText>
                </View>

                <View
                    style={[
                        style.infoCard,
                        { backgroundColor: colors.card },
                        cardChrome,
                    ]}>
                    <ThemeText fontSize="subTitle" style={style.cardTitle}>
                        {t("about.responsibilityTitle")}
                    </ThemeText>
                    <ThemeText style={style.cardContent}>
                        {t("about.responsibilityContent")}
                    </ThemeText>
                </View>

                <View
                    style={[
                        style.infoCard,
                        { backgroundColor: colors.card },
                        cardChrome,
                    ]}>
                    <ThemeText fontSize="subTitle" style={style.cardTitle}>
                        {t("about.originalAuthor")}
                    </ThemeText>
                    <ThemeText style={style.cardContent}>猫头猫</ThemeText>
                    <LinkText linkTo="https://github.com/maotoumao/MusicFree">
                        https://github.com/maotoumao/MusicFree
                    </LinkText>
                </View>

                <View
                    style={[
                        style.infoCard,
                        { backgroundColor: colors.card },
                        cardChrome,
                    ]}>
                    <ThemeText fontSize="subTitle" style={style.cardTitle}>
                        {t("about.upstreamAuthor")}
                    </ThemeText>
                    <ThemeText style={style.cardContent}>Toskysun</ThemeText>
                    <LinkText linkTo="https://github.com/Toskysun/MusicFree">
                        https://github.com/Toskysun/MusicFree
                    </LinkText>
                </View>

                <View
                    style={[
                        style.infoCard,
                        { backgroundColor: colors.card },
                        cardChrome,
                    ]}>
                    <ThemeText fontSize="subTitle" style={style.cardTitle}>
                        {t("about.directFoundation")}
                    </ThemeText>
                    <ThemeText style={style.cardContent}>Merilune</ThemeText>
                    <LinkText linkTo="https://github.com/Merilune/MusicFree">
                        https://github.com/Merilune/MusicFree
                    </LinkText>
                </View>
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
        height: rpx(400),
        justifyContent: "center",
        alignItems: "center",
        marginBottom: rpx(40),
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
        paddingHorizontal: rpx(24),
        paddingTop: rpx(12),
    },
    scrollViewContainer: {
        paddingBottom: rpx(96),
    },
    infoCard: {
        padding: rpx(24),
        borderRadius: rpx(16),
        marginBottom: rpx(16),
        // elevation/shadow applied only when NOT custom wallpaper (see cardChrome)
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
    },
    cardTitle: {
        marginBottom: rpx(12),
        opacity: 0.7,
    },
    cardContent: {
        fontSize: fontRpx(28),
    },
    actionCard: {
        borderRadius: rpx(16),
        marginBottom: rpx(16),
        overflow: "hidden",
        elevation: 2,
    },
    actionRow: {
        minHeight: rpx(100),
        paddingHorizontal: rpx(24),
        flexDirection: "row",
        alignItems: "center",
    },
    actionText: {
        flex: 1,
        minWidth: 0,
        marginLeft: rpx(18),
    },
    actionDescription: {
        marginTop: rpx(6),
    },
    releaseLine: {
        marginBottom: rpx(10),
        lineHeight: fontRpx(40),
    },
});
