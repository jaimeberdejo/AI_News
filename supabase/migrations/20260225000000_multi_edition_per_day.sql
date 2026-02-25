-- Allow multiple editions per day (e.g. morning + evening pipeline runs)
-- Drops the UNIQUE constraint on edition_date so each pipeline run
-- creates its own edition row identified by UUID.
ALTER TABLE editions DROP CONSTRAINT editions_edition_date_key;
