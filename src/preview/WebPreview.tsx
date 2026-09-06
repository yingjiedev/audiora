import React, { useState } from "react";
import {
    Image,
    ImageSourcePropType,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import Icon, { IIconName } from "@/components/base/icon";

const defaultCover = require("@/assets/imgs/album-default.jpeg");
const heroArtwork = require("@/assets/imgs/home-hero-mountain.png");
const quickLocalArtwork = require("@/assets/imgs/quick-local-v2.png");
const quickHistoryArtwork = require("@/assets/imgs/quick-history-v2.png");
const quickFavoriteArtwork = require("@/assets/imgs/quick-favorite-v2.png");
const quickFolderArtwork = require("@/assets/imgs/quick-folder-v2.png");
const heroBackgroundStyle = {
    backgroundImage: `url("${(heroArtwork as { uri: string }).uri}")`,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "100% 100%",
} as never;

type TabKey = "home" | "library" | "music" | "settings";

interface PreviewTrack {
    id: string;
    title: string;
    subtitle: string;
    artwork?: ImageSourcePropType;
}

const tracks: PreviewTrack[] = [
    {
        id: "morning",
        title: "清晨旋律",
        subtitle: "开启美好的一天",
        artwork: { uri: "https://picsum.photos/seed/audiora-morning/480/360" },
    },
    {
        id: "indigo",
        title: "独立之声",
        subtitle: "发现小众音乐",
        artwork: { uri: "https://picsum.photos/seed/audiora-indigo/480/360" },
    },
    {
        id: "violet",
        title: "电子漫游",
        subtitle: "探索电子世界",
        artwork: { uri: "https://picsum.photos/seed/audiora-violet/480/360" },
    },
];

const quickEntries: Array<{
    title: string;
    subtitle: string;
    artwork: ImageSourcePropType;
    color: string;
}> = [
    { title: "本地音乐", subtitle: "961 首", artwork: quickLocalArtwork, color: "#F0FCFA" },
    { title: "最近播放", subtitle: "28 首", artwork: quickHistoryArtwork, color: "#F4F6FF" },
    { title: "我喜欢", subtitle: "56 首", artwork: quickFavoriteArtwork, color: "#FFF7F9" },
    { title: "文件夹导入", subtitle: "扫描音乐", artwork: quickFolderArtwork, color: "#F2FBFF" },
];

const platforms: Array<{ title: string; subtitle: string; icon: IIconName; color: string; iconColor: string }> = [
    { title: "网易云", subtitle: "已连接", icon: "circle-stack", color: "#FFF0F1", iconColor: "#EF3340" },
    { title: "Bandcamp", subtitle: "已连接", icon: "album-outline", color: "#ECF8FF", iconColor: "#38A9E0" },
    { title: "SoundCloud", subtitle: "可连接", icon: "musical-note", color: "#FFF3E9", iconColor: "#FF7139" },
    { title: "更多平台", subtitle: "探索更多", icon: "strategy", color: "#EEF1FF", iconColor: "#526CFF" },
];

const tabs: Array<{ key: TabKey; label: string; icon: IIconName }> = [
    { key: "home", label: "首页", icon: "home-outline" },
    { key: "library", label: "音乐库", icon: "album-outline" },
    { key: "music", label: "我的音乐", icon: "heart-outline" },
    { key: "settings", label: "设置", icon: "cog-8-tooth" },
];

function Artwork({ source, style }: { source?: ImageSourcePropType; style: object }) {
    const [failed, setFailed] = useState(false);
    return (
        <Image
            source={!source || failed ? defaultCover : source}
            style={style}
            resizeMode="cover"
            onError={() => setFailed(true)}
        />
    );
}

function StatusBar() {
    return (
        <View style={styles.statusBar}>
            <Text style={styles.statusTime}>9:41</Text>
            <View style={styles.statusIcons}>
                <Text style={styles.statusGlyph}>●</Text>
                <Text style={styles.statusGlyph}>◔</Text>
                <View style={styles.battery} />
            </View>
        </View>
    );
}

function SectionHeading({ title }: { title: string }) {
    return (
        <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <Text style={styles.moreText}>更多 ›</Text>
        </View>
    );
}

function PlatformCards() {
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.platformRow}>
            {platforms.map(item => (
                <Pressable key={item.title} style={styles.platformCard}>
                    <View style={[styles.platformIcon, { backgroundColor: item.color }]}>
                        <Icon name={item.icon} size={22} color={item.iconColor} />
                    </View>
                    <Text style={styles.platformTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.platformSubtitle}>{item.subtitle}</Text>
                </Pressable>
            ))}
        </ScrollView>
    );
}

function Home({ onPlay }: { onPlay: (track: PreviewTrack) => void }) {
    const [feed, setFeed] = useState<"recommend" | "discover">("recommend");
    return (
        <>
            <View style={styles.topRow}>
                <View style={styles.feedTabs}>
                    <Pressable onPress={() => setFeed("recommend")}>
                        <Text style={[styles.feedTab, feed === "recommend" && styles.feedTabActive]}>推荐</Text>
                        {feed === "recommend" ? <View style={styles.feedIndicator} /> : null}
                    </Pressable>
                    <Pressable onPress={() => setFeed("discover")}>
                        <Text style={[styles.feedTab, feed === "discover" && styles.feedTabActive]}>发现</Text>
                        {feed === "discover" ? <View style={styles.feedIndicator} /> : null}
                    </Pressable>
                </View>
                <Pressable style={styles.iconButton}>
                    <Icon name="alarm-outline" size={20} color="#17213E" />
                </Pressable>
            </View>

            <View style={styles.searchBar}>
                <Icon name="magnifying-glass" size={14} color="#8B96AD" />
                <TextInput
                    placeholder="搜索本地音乐、歌曲、专辑或平台内容"
                    placeholderTextColor="#A1AABE"
                    style={styles.searchInput}
                />
                <Icon name="crosshair" size={16} color="#6E7B96" />
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.homeContent} showsVerticalScrollIndicator={false}>
                <Pressable onPress={() => onPlay(tracks[0])}>
                    <View style={[styles.hero, heroBackgroundStyle]}>
                        <View style={styles.heroShade} />
                        <View style={styles.heroCopy}>
                            <Text style={styles.heroTitle}>让音乐{"\n"}去更远的地方</Text>
                            <Text style={styles.heroSubtitle}>本地 · 平台 · 无限发现</Text>
                        </View>
                        <View style={styles.heroPlay}>
                            <Icon name="play" size={17} color="#17213E" />
                        </View>
                    </View>
                </Pressable>

                <View style={styles.quickGrid}>
                    {quickEntries.map(item => (
                        <Pressable key={item.title} style={[styles.quickCard, { backgroundColor: item.color }]}>
                            <Image source={item.artwork} style={styles.quickArtwork} resizeMode="contain" />
                            <View>
                                <Text style={styles.quickTitle}>{item.title}</Text>
                                <Text style={styles.quickSubtitle}>{item.subtitle}</Text>
                            </View>
                        </Pressable>
                    ))}
                </View>

                <SectionHeading title="为你推荐" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendationRow}>
                    {tracks.map(track => (
                        <Pressable key={track.id} style={styles.recommendationCard} onPress={() => onPlay(track)}>
                            <Artwork source={track.artwork} style={styles.recommendationCover} />
                            <Text style={styles.recommendationTitle} numberOfLines={1}>{track.title}</Text>
                            <Text style={styles.recommendationSubtitle} numberOfLines={1}>{track.subtitle}</Text>
                        </Pressable>
                    ))}
                </ScrollView>

                <SectionHeading title="继续聆听" />
                <Pressable style={styles.continueCard} onPress={() => onPlay(tracks[0])}>
                    <Artwork source={tracks[0].artwork} style={styles.continueCover} />
                    <View style={styles.continueInfo}>
                        <Text style={styles.continueTitle}>{tracks[0].title}</Text>
                        <Text style={styles.continueArtist}>Lenka</Text>
                    </View>
                    <View style={styles.smallPlay}>
                        <Icon name="play" size={13} color="#FFFFFF" />
                    </View>
                    <Icon name="playlist" size={19} color="#62708D" />
                </Pressable>
            </ScrollView>
        </>
    );
}

function SecondaryScreen({ tab }: { tab: Exclude<TabKey, "home"> }) {
    const title = tab === "library" ? "音乐库" : tab === "music" ? "我的音乐" : "设置";
    const rows = tab === "settings"
        ? ["通用设置", "音乐源管理", "本地音乐扫描", "主题设置", "权限管理", "关于 Audiora"]
        : ["本地音乐", "最近播放", "我的歌单", "已接入的平台"];
    return (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.secondaryContent}>
            <Text style={styles.secondaryTitle}>{title}</Text>
            {rows.map((row, index) => (
                <Pressable key={row} style={styles.settingRow}>
                    <View style={[styles.settingIcon, { backgroundColor: index % 2 ? "#ECFAF7" : "#ECF2FF" }]}>
                        <Icon name={index % 2 ? "musical-note" : "cog-8-tooth"} size={19} color={index % 2 ? "#00BE9A" : "#4778F6"} />
                    </View>
                    <Text style={styles.settingTitle}>{row}</Text>
                    <Text style={styles.chevron}>›</Text>
                </Pressable>
            ))}
            {tab === "settings" ? (
                <View style={styles.settingsPlatforms}>
                    <SectionHeading title="已接入的平台" />
                    <PlatformCards />
                </View>
            ) : null}
        </ScrollView>
    );
}

function Player({ track, onClose }: { track: PreviewTrack; onClose: () => void }) {
    const [paused, setPaused] = useState(false);
    return (
        <View style={styles.player}>
            <Pressable style={styles.playerClose} onPress={onClose}>
                <Icon name="arrow-uturn-left" size={22} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.playerKicker}>正在播放</Text>
            <Artwork source={track.artwork} style={styles.playerCover} />
            <Text style={styles.playerTitle}>{track.title}</Text>
            <Text style={styles.playerArtist}>{track.subtitle}</Text>
            <View style={styles.progress}><View style={styles.progressValue} /></View>
            <View style={styles.playerControls}>
                <Icon name="skip-left" size={27} color="#FFFFFF" />
                <Pressable style={styles.pauseButton} onPress={() => setPaused(value => !value)}>
                    <Icon name={paused ? "play" : "pause"} size={27} color="#386CFF" />
                </Pressable>
                <Icon name="skip-right" size={27} color="#FFFFFF" />
            </View>
        </View>
    );
}

export default function WebPreview() {
    const [tab, setTab] = useState<TabKey>("home");
    const [playing, setPlaying] = useState<PreviewTrack | null>(null);
    return (
        <View style={styles.stage}>
            <View style={styles.phone}>
                <StatusBar />
                {playing ? (
                    <Player track={playing} onClose={() => setPlaying(null)} />
                ) : (
                    <>
                        {tab === "home" ? <Home onPlay={setPlaying} /> : <SecondaryScreen tab={tab} />}
                        <View style={styles.tabBar}>
                            {tabs.map(item => {
                                const active = item.key === tab;
                                return (
                                    <Pressable key={item.key} style={styles.tabItem} onPress={() => setTab(item.key)}>
                                        <Icon name={item.icon} size={21} color={active ? "#2867FF" : "#8491AD"} />
                                        <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.label}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    stage: {
        flex: 1,
        minHeight: "100vh" as never,
        paddingVertical: 24,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#EAF2FF",
    },
    phone: {
        width: 393,
        height: 852,
        maxWidth: "calc(100vw - 24px)" as never,
        maxHeight: "calc(100vh - 24px)" as never,
        overflow: "hidden",
        borderRadius: 30,
        backgroundColor: "#FFFFFF",
        boxShadow: "0 22px 60px rgba(43,72,124,0.18)" as never,
    },
    statusBar: { height: 32, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    statusTime: { fontSize: 12, fontWeight: "700", color: "#10172E" },
    statusIcons: { flexDirection: "row", alignItems: "center", gap: 4 },
    statusGlyph: { fontSize: 8, color: "#10172E" },
    battery: { width: 14, height: 7, borderRadius: 2, backgroundColor: "#10172E", transform: [{ skewX: "-10deg" }] },
    topRow: { height: 45, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    feedTabs: { flexDirection: "row", alignItems: "center", gap: 20 },
    feedTab: { fontSize: 19, lineHeight: 26, fontWeight: "600", color: "#77829C" },
    feedTabActive: { color: "#17213E", fontWeight: "800" },
    feedIndicator: { width: 28, height: 3, marginTop: 1, borderRadius: 2, backgroundColor: "#23BED7" },
    iconButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
    searchBar: { height: 32, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 11, borderRadius: 16, flexDirection: "row", alignItems: "center", backgroundColor: "#F3F6FC" },
    searchInput: { flex: 1, height: 32, paddingHorizontal: 8, paddingVertical: 0, borderWidth: 0, fontSize: 10, color: "#17213E" },
    scroll: { flex: 1 },
    homeContent: { paddingHorizontal: 16, paddingBottom: 82 },
    hero: { width: "100%", aspectRatio: 2.5, justifyContent: "center", overflow: "hidden", borderRadius: 15 },
    heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,34,91,0.08)" },
    heroCopy: { marginLeft: 20 },
    heroTitle: { fontSize: 22, lineHeight: 27, fontWeight: "800", color: "#FFFFFF", textShadowColor: "rgba(12,31,84,0.24)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
    heroSubtitle: { marginTop: 8, fontSize: 12, fontWeight: "500", color: "rgba(255,255,255,0.92)" },
    heroPlay: { position: "absolute", right: 18, bottom: 17, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
    quickGrid: { marginTop: 10, flexDirection: "row", gap: 7 },
    quickCard: { flex: 1, height: 118, paddingHorizontal: 3, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    quickArtwork: { width: 48, height: 48, marginBottom: 7 },
    quickTitle: { fontSize: 12, lineHeight: 17, fontWeight: "700", textAlign: "center", color: "#27324B" },
    quickSubtitle: { marginTop: 2, fontSize: 10, lineHeight: 14, fontWeight: "500", textAlign: "center", color: "#8792A8" },
    sectionHeading: { marginTop: 14, marginBottom: 7, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    sectionTitle: { fontSize: 14, lineHeight: 20, fontWeight: "800", color: "#17213E" },
    moreText: { fontSize: 10, fontWeight: "600", color: "#8994AA" },
    recommendationRow: { gap: 8 },
    recommendationCard: { width: 113 },
    recommendationCover: { width: 113, height: 78, borderRadius: 11, backgroundColor: "#EEF2F8" },
    recommendationTitle: { marginTop: 5, fontSize: 11, lineHeight: 15, fontWeight: "700", color: "#17213E" },
    recommendationSubtitle: { marginTop: 1, fontSize: 9, color: "#8B96AC" },
    platformRow: { gap: 8 },
    platformCard: { width: 82, height: 76, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#F8FAFD" },
    platformIcon: { width: 33, height: 33, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    platformTitle: { width: 76, marginTop: 4, fontSize: 9, fontWeight: "700", textAlign: "center", color: "#17213E" },
    platformSubtitle: { marginTop: 1, fontSize: 8, color: "#8A96AD" },
    continueCard: { height: 56, marginBottom: 4, paddingHorizontal: 8, borderRadius: 13, flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", boxShadow: "0 5px 18px rgba(49,72,118,0.11)" as never },
    continueCover: { width: 42, height: 42, borderRadius: 8, backgroundColor: "#EEF2F8" },
    continueInfo: { flex: 1, marginLeft: 10 },
    continueTitle: { fontSize: 11, fontWeight: "700", color: "#17213E" },
    continueArtist: { marginTop: 2, fontSize: 9, color: "#8994AA" },
    smallPlay: { width: 27, height: 27, marginRight: 13, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#3E78F6" },
    tabBar: { position: "absolute", right: 0, bottom: 0, left: 0, height: 64, paddingTop: 8, flexDirection: "row", backgroundColor: "rgba(255,255,255,0.98)", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E8ECF4" },
    tabItem: { flex: 1, alignItems: "center", gap: 3 },
    tabLabel: { fontSize: 9, fontWeight: "600", color: "#8491AD" },
    tabLabelActive: { color: "#2867FF", fontWeight: "800" },
    secondaryContent: { paddingHorizontal: 16, paddingBottom: 86 },
    secondaryTitle: { marginTop: 12, marginBottom: 18, fontSize: 22, fontWeight: "800", color: "#17213E" },
    settingsPlatforms: { marginTop: 6 },
    settingRow: { height: 59, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E7EBF2" },
    settingIcon: { width: 36, height: 36, marginRight: 12, borderRadius: 11, alignItems: "center", justifyContent: "center" },
    settingTitle: { flex: 1, fontSize: 13, fontWeight: "600", color: "#26324C" },
    chevron: { fontSize: 22, color: "#8793AA" },
    player: { flex: 1, paddingHorizontal: 28, alignItems: "center", backgroundColor: "#386CFF" },
    playerClose: { position: "absolute", top: 18, left: 18, zIndex: 2, width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    playerKicker: { marginTop: 25, fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.8)" },
    playerCover: { width: 300, height: 300, maxWidth: "80vw" as never, maxHeight: "80vw" as never, marginTop: 80, borderRadius: 22, backgroundColor: "#EEF2F8" },
    playerTitle: { alignSelf: "stretch", marginTop: 43, fontSize: 23, fontWeight: "800", color: "#FFFFFF" },
    playerArtist: { alignSelf: "stretch", marginTop: 7, fontSize: 13, color: "rgba(255,255,255,0.78)" },
    progress: { alignSelf: "stretch", height: 3, marginTop: 28, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.35)" },
    progressValue: { width: "54%", height: 3, borderRadius: 2, backgroundColor: "#FFFFFF" },
    playerControls: { width: 230, marginTop: 35, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    pauseButton: { width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
});
