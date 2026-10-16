import { useI18N } from "@/core/i18n";
import MusicSheet from "@/core/musicSheet";
import { FavoriteGroups, useFavoriteGroups } from "@/core/favoriteGroups";
import { showDialog } from "@/components/dialogs/useDialog";
import { usePluginDisplayNameResolver } from "@/core/pluginManager";
import Toast from "@/utils/toast";
import { TrackGroup } from "@/utils/trackGroup";

export default function useFavoriteGroupActions() {
    const state = useFavoriteGroups();
    const { t } = useI18N();
    const getDisplayName = usePluginDisplayNameResolver();
    const save = async (operation: () => Promise<unknown>) => {
        try {
            await operation();
        } catch {
            Toast.warn(t("aggregate.updateFailed"));
        }
    };
    return {
        state,
        actions: {
            link(group: TrackGroup, selected: IMusic.IMusicItem) {
                const items = MusicSheet.favorites.linkPreview(group.candidates);
                let saving = false;
                showDialog("SimpleDialog", {
                    title: t("aggregate.linkFavorites"),
                    content: `${t("aggregate.linkConfirm", { count: items.length })}\n\n${items.map(item => `${getDisplayName(item.platform)} · ${item.title} · ${item.artist}`).join("\n")}`,
                    async onOk() {
                        if (saving) return;
                        saving = true;
                        await save(() => MusicSheet.favorites.link(items, selected));
                    },
                });
            },
            split(group: TrackGroup) {
                const count = FavoriteGroups.get().groups.find(item => item.id === group.groupId)?.memberKeys.length ?? group.candidates.length;
                showDialog("SimpleDialog", {
                    title: t("aggregate.splitFavorites"),
                    content: t("aggregate.splitConfirm", { count }),
                    onOk: () => save(() => MusicSheet.favorites.split(group.groupId!)),
                });
            },
            removeSource: (item: IMusic.IMusicItem) => save(() => MusicSheet.removeMusic(MusicSheet.defaultSheet.id, item)),
            prefer: (item: IMusic.IMusicItem) => save(() => MusicSheet.favorites.prefer(item)),
        },
    };
}
