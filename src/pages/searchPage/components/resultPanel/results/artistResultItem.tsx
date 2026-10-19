import { radius, spacing } from "@/constants/designSystem";
import React from "react";
import ListItem from "@/components/base/listItem";
import { ImgAsset } from "@/constants/assetsConst";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import { usePluginDisplayNameResolver } from "@/core/pluginManager";
import TitleAndTag from "@/components/mediaItem/titleAndTag";
import { useI18N } from "@/core/i18n";
import { View, StyleSheet } from "react-native";
import rpx from "@/utils/rpx";
import useColors from "@/hooks/useColors";
import useCardStyle from "@/hooks/useCardStyle";

interface IArtistResultsProps {
    item: IArtist.IArtistItem;
    index: number;
    pluginHash: string;
}
export default function ArtistResultItem(props: IArtistResultsProps) {
    const { item: artistItem, pluginHash } = props;
    const navigate = useNavigate();
    const getPluginDisplayName = usePluginDisplayNameResolver();
    const { t } = useI18N();
    const colors = useColors();
    const cardStyle = useCardStyle({
        borderWidth: 0,
        elevation: 0,
    });

    return (
        <View
            style={[
                styles.cardWrapper,
                {
                    backgroundColor: colors.card,
                },
                cardStyle,
            ]}>
            <ListItem
                withHorizontalPadding
                heightType="big"
                onPress={() => {
                    navigate(ROUTE_PATH.ARTIST_DETAIL, {
                        artistItem: artistItem,
                        pluginHash,
                    });
                }}>
                <ListItem.ListItemImage
                    uri={artistItem.avatar}
                    fallbackImg={ImgAsset.albumDefault}
                />
                <ListItem.Content
                    description={
                        artistItem.desc
                            ? artistItem.desc
                            : `${artistItem.worksNum
                                ? t("searchPage.artistResultWorksNum", {
                                    count: artistItem.worksNum,
                                })
                                : ""
                            }    ${artistItem.description ?? ""}`
                    }
                    title={
                        <TitleAndTag
                            title={artistItem.name}
                            tag={getPluginDisplayName(artistItem.platform)}
                        />
                    }
                />
            </ListItem>
        </View>
    );
}

const styles = StyleSheet.create({
    cardWrapper: {
        marginHorizontal: spacing.xxxl,
        marginVertical: spacing.xxs,
        borderRadius: radius.lg,
        overflow: "hidden",
        shadowOffset: {
            width: 0,
            height: rpx(2),
        },
        shadowRadius: 0,
    },
});
