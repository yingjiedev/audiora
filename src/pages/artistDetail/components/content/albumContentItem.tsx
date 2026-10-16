import { radius, spacing } from "@/constants/designSystem";
import React from "react";
import AlbumItem from "@/components/mediaItem/albumItem";
import { View, StyleSheet } from "react-native";
import rpx from "@/utils/rpx";
import useColors from "@/hooks/useColors";
import useCardStyle from "@/hooks/useCardStyle";

interface IAlbumContentProps {
    item: IAlbum.IAlbumItem;
}
export default function AlbumContentItem(props: IAlbumContentProps) {
    const { item } = props;
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
            <AlbumItem albumItem={item} />
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
